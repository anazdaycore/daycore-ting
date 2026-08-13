import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from '@daycore/core';
import { flowAt, nowMin, type Flow } from './flow';
import type { Catalog } from '@daycore/core';

// 汀's state: the day, the pending proposals, and the thing you can still undo.
//
// ⚠️ No optimistic updates on writes. Every action re-reads, and that is the
// point rather than laziness: PATCH /api/plan can be REFUSED with 409 by the
// plan gate (a locked or petrified block), and a proposal can be answered by a
// second tab between the render and the tap. 汀's entire premise is that the
// screen answers "what now" truthfully — a screen showing a completed task the
// server still considers open is the one failure it cannot afford.
//
// The cost is a round trip per action, on a screen that shows one thing at a
// time. That is the cheap direction.

export interface UndoOffer {
  opId: string;
  label: string;
  until: number;
}

/** A 409 from the plan gate, kept so the UI can offer the ways OUT of it —
 *  "you cannot" without "but you could instead" is the one failure the tone
 *  rules name outright. */
export interface GateRefusal {
  code: 'locked' | 'petrified' | 'refish_capped' | string;
  blockId: string;
  lockLevel?: string;
  confirmable?: boolean;
  message: string;
}

export interface Store {
  flow: Flow;
  /** The raw day — the peek axis reads blocks off it directly. */
  plan: api.DayPlan | null;
  proposals: api.Proposal[];
  undo: UndoOffer | null;
  busy: boolean;
  error: string;
  gate: GateRefusal | null;
  date: string;
  /** Blocks the reader sent away via markMissed, this session only. */
  dismissed: ReadonlySet<string>;
  /** Take a block off the "what now" face for this session without writing
   *  anything — used after a successful refish, where the record should stay
   *  exactly as it is. */
  dismissForNow: (id: string) => void;
  complete: (b: api.TimeBlock) => Promise<boolean>;
  answer: (p: api.Proposal, accept: boolean) => Promise<boolean>;
  /** Take one row of a compound card. ⚠️ Not the same call as answer — see the
   *  note on the implementation. */
  take: (p: api.Proposal, rowID: string) => Promise<boolean>;
  /** Confirm capture candidates into today: one add each, gated per block. */
  capture: (blocks: api.TimeBlock[]) => Promise<boolean>;
  /** 没做：the past is not rewritten — record it in the note (the field built
   *  for "how it went") and take the block off the "what now" face for this
   *  session. completed stays false, which IS the truth of it. */
  markMissed: (b: api.TimeBlock) => Promise<boolean>;
  /** 推明天：remove today + add tomorrow (a date in patch changes is a silent
   *  no-op — verified live). The plan gate still applies: a locked or petrified
   *  block comes back as a GateRefusal with its exits. */
  pushTomorrow: (b: api.TimeBlock) => Promise<boolean>;
  remove: (b: api.TimeBlock) => Promise<boolean>;
  /** 重新安排：the original stays as the record; tomorrow gets a new block
   *  chained to it. Server counts the chain; tasks only (appointments and
   *  done things are not refishable — domain/refish.go). */
  refish: (b: api.TimeBlock, toDate: string) => Promise<boolean>;
  /** Unlock a block (lock_level none) — one of the ways out of a lock refusal. */
  unlock: (b: api.TimeBlock) => Promise<boolean>;
  /** 标记冲突 — the third way out: the class really is colliding. */
  conflict: (b: api.TimeBlock) => Promise<boolean>;
  /** 记一下心情 — one tap, undoable like everything else. The id is the wire
   *  value; the label is only for the undo line. */
  recordMood: (mood: string, label?: string) => Promise<boolean>;
  /** 先不看 — hide every pending card for this session. A client-side hide,
   *  NOT a rejection: silence must never settle anything, so nothing is sent. */
  skipAll: () => void;
  clearGate: () => void;
  takeBack: () => Promise<void>;
  dismissUndo: () => void;
  refresh: () => Promise<void>;
}

/** How long an undo stays offered. Matches the prototype's 3s bar. */
const UNDO_MS = 3000;

export function useStore(cat: Catalog): Store {
  const [plan, setPlan] = useState<api.DayPlan | null>(null);
  const [proposals, setProposals] = useState<api.Proposal[]>([]);
  const [undo, setUndo] = useState<UndoOffer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [gate, setGate] = useState<GateRefusal | null>(null);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const [tick, setTick] = useState(() => nowMin());
  const date = api.todayIso();
  // ⚠️ The undo bar's label is user-visible copy and goes through the
  // catalogue like everything else. It was the last hardcoded string in 汀, and
  // it hid here rather than in a component — which is exactly where this kind
  // of thing survives a copy pass. The catalogue comes in as a parameter so a
  // language switched mid-session reaches these labels too, not just the JSX.
  const t = cat.t;

  // A minute hand. 30s so the "还剩 N 分钟" line is never more than half a
  // minute stale — 汀 shows one number and it is the one people check.
  useEffect(() => {
    const t = setInterval(() => setTick(nowMin()), 30_000);
    return () => clearInterval(t);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [p, ps] = await Promise.all([api.planForDate(date), api.proposals()]);
      setPlan(p);
      // Only pending ones, minus any the reader waved off this session. The
      // list can carry settled rows, and a card that comes back after being
      // answered is the single most alarming thing this screen could do.
      setProposals((ps.proposals ?? []).filter((x) => x.state === 'pending' && !skipped.has(x.id)));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [date, skipped]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // The undo offer expires on its own.
  const timer = useRef<number | null>(null);
  const offer = useCallback((opId: string, label: string) => {
    setUndo({ opId, label, until: Date.now() + UNDO_MS });
    if (timer.current) clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setUndo(null), UNDO_MS);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  /** The op this action produced, so it can be offered back.
   *
   * ⚠️ Read from GET /api/ops AFTER the write, rather than from the write's own
   * response — the write endpoints return the new state, not the operation id.
   * That is one extra request per action and it is what makes undo real; an
   * undo bar that cannot name what it would undo is decoration. */
  const latestOp = useCallback(async (): Promise<string | null> => {
    try {
      const { ops } = await api.ops(1);
      const top = ops?.[0];
      return top ? top.id : null;
    } catch {
      return null;
    }
  }, []);

  const act = useCallback(
    async (run: () => Promise<void>, label: string): Promise<boolean> => {
      setBusy(true);
      setError('');
      setGate(null);
      try {
        await run();
        const opId = await latestOp();
        await refresh();
        if (opId) offer(opId, label);
        return true;
      } catch (e) {
        if (e instanceof api.ApiError && e.status === 409) {
          // The plan gate refused. Its message is written for a person and is
          // the whole reason this is not optimistic — see docs/specs. The
          // refusal is KEPT (code + blockId) so the sheet can render the ways
          // out of it, not just the sentence.
          const b = (e.body ?? {}) as { code?: string; blockId?: string; lockLevel?: string; confirmable?: boolean };
          setGate({
            code: b.code ?? 'blocked',
            blockId: b.blockId ?? '',
            lockLevel: b.lockLevel,
            confirmable: b.confirmable,
            message: e.message,
          });
          setError(e.message);
        } else {
          setError(e instanceof Error ? e.message : String(e));
        }
        await refresh();
        return false;
      } finally {
        setBusy(false);
      }
    },
    [latestOp, offer, refresh],
  );

  const complete = useCallback(
    (b: api.TimeBlock) =>
      act(
        () =>
          api
            .patchPlan(date, { action: 'update', match: { id: b.id }, changes: { completed: true } })
            .then(() => undefined),
        t('undo.completed', { title: b.title }),
      ),
    [act, date, t],
  );

  const answer = useCallback(
    (p: api.Proposal, accept: boolean) =>
      act(
        () => api.respondToProposal(p.id, accept).then(() => undefined),
        t(accept ? 'undo.accepted' : 'undo.rejected', { title: p.title }),
      ),
    [act, t],
  );

  /**
   * Take one row of a compound card.
   *
   * ⚠️ A compound card CANNOT be answered by `answer(p, true)`. The server reads
   * the choice as a row id, so "accept" matches nothing: the card flips to
   * accepted, the ops hanging off its rows never run, and the reader watches a
   * button do nothing — silently, with a 200.
   *
   * Every card the daemon producers emit is compound, so this is the ordinary
   * path rather than an edge case.
   */
  const take = useCallback(
    (p: api.Proposal, rowID: string) =>
      act(
        () => api.respondToProposalRow(p.id, rowID).then(() => undefined),
        t('undo.accepted', { title: p.title }),
      ),
    [act, t],
  );

  /** The day after `date`, in the browser's own calendar — the same calendar
   *  the blocks' wall-clock times already read. */
  const tomorrowIso = useCallback(() => {
    const [y = 1970, m = 1, d = 1] = date.split('-').map(Number);
    const dt = new Date(y, m - 1, d + 1);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
  }, [date]);

  const capture = useCallback(
    (blocks: api.TimeBlock[]) =>
      act(async () => {
        // ⚠️ Sequential gated adds, NOT a full-day PUT. PUT /api/plan replaces
        // the day wholesale and never meets the plan gate — a lock or a frozen
        // block it silently tramples is exactly the failure the gate exists
        // for. The price is one op per block, of which the undo bar offers the
        // last; every one is in the ledger.
        for (const b of blocks) {
          await api.patchPlan(date, {
            action: 'add',
            block: {
              id: b.id,
              time: b.time,
              title: b.title,
              type: b.type,
              duration_min: b.duration_min,
              ...(b.time_mode ? { time_mode: b.time_mode } : {}),
              ...(b.timezone ? { timezone: b.timezone } : {}),
            },
          });
        }
      }, t('undo.captured', { n: blocks.length, title: blocks[0]?.title ?? '' })),
    [act, date, t],
  );

  const markMissed = useCallback(
    (b: api.TimeBlock) =>
      act(
        () =>
          api
            .patchPlan(date, {
              action: 'update',
              match: { id: b.id },
              changes: { note: (b.note ? b.note + ' · ' : '') + t('now.missedMark') },
            })
            .then(() => undefined),
        t('undo.missed'),
      ).then((ok) => {
        // Off the "what now" face for this session. The block itself keeps
        // completed=false — that is not a rewrite, it is what happened — and
        // the note says so in the reader's own words, which the agent reads.
        if (ok) setDismissed((prev) => new Set(prev).add(b.id));
        return ok;
      }),
    [act, date, t],
  );

  const pushTomorrow = useCallback(
    (b: api.TimeBlock) =>
      act(async () => {
        // A date inside patch changes is a silent no-op (verified live: 200,
        // block stays in its own day's document). A move is remove + add.
        // Remove goes FIRST so a gate refusal leaves nothing half-moved.
        await api.patchPlan(date, { action: 'remove', match: { id: b.id } });
        await api.patchPlan(tomorrowIso(), {
          action: 'add',
          block: {
            id: b.id + '-tmr-' + Date.now().toString(36),
            time: b.time,
            title: b.title,
            type: b.type,
            duration_min: b.duration_min,
            ...(b.time_mode ? { time_mode: b.time_mode } : {}),
            ...(b.timezone ? { timezone: b.timezone } : {}),
          },
        });
      }, t('undo.pushed')),
    [act, date, tomorrowIso, t],
  );

  const remove = useCallback(
    (b: api.TimeBlock) =>
      act(
        () => api.patchPlan(date, { action: 'remove', match: { id: b.id } }).then(() => undefined),
        t('undo.removed', { title: b.title }),
      ),
    [act, date, t],
  );

  const refish = useCallback(
    (b: api.TimeBlock, toDate: string) =>
      act(
        () =>
          api
            .refishBlock(toDate, {
              title: b.title,
              type: b.type,
              time: b.time,
              duration_min: b.duration_min,
              rescheduled_from: b.id,
            })
            .then(() => undefined),
        t('undo.refished'),
      ),
    [act, t],
  );

  const unlock = useCallback(
    (b: api.TimeBlock) =>
      act(() => api.lockPlanBlock(date, b.id, 'none').then(() => undefined), t('undo.unlocked')),
    [act, date, t],
  );

  const conflict = useCallback(
    (b: api.TimeBlock) =>
      act(() => api.markConflict(date, b.id).then(() => undefined), t('undo.conflict')),
    [act, date, t],
  );

  const recordMood = useCallback(
    (mood: string, label?: string) =>
      act(
        () => api.recordMood(mood).then(() => undefined),
        t('undo.mood', { mood: label ?? mood }),
      ),
    [act, t],
  );

  const takeBack = useCallback(async () => {
    if (!undo) return;
    const id = undo.opId;
    setUndo(null);
    setBusy(true);
    try {
      await api.revertOp(id);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [undo, refresh]);

  const flow = flowAt(plan, tick);
  // A block sent away as 没做 stops being the answer to "what now" for this
  // session. It is still in the plan, still completed=false — see markMissed.
  if (flow.current && dismissed.has(flow.current.id)) flow.current = null;

  return {
    flow,
    plan,
    proposals,
    undo,
    busy,
    error,
    gate,
    date,
    dismissed,
    dismissForNow: (id: string) => setDismissed((prev) => new Set(prev).add(id)),
    complete,
    answer,
    take,
    capture,
    markMissed,
    pushTomorrow,
    remove,
    refish,
    unlock,
    conflict,
    recordMood,
    skipAll: () => setSkipped((prev) => new Set([...prev, ...proposals.map((p) => p.id)])),
    clearGate: () => setGate(null),
    takeBack,
    dismissUndo: () => setUndo(null),
    refresh,
  };
}
