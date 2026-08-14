import { useEffect, useState } from 'react';
import * as api from '@daycore/core';
import type { Assignment, Catalog, Course, OperationLog, Proposal, Wish } from '@daycore/core';
import { toMin } from './flow';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import type { Store } from './store';

// The four pull-out surfaces of 汀: the day's mini axis (peek), the ledger,
// the radar, and the "why" of a card. All are READ surfaces plus the few
// buttons the product allows on each — nothing here writes except through the
// same store actions the main faces use.

function relDay(t: Catalog['t'], date: string, today: string): string {
  const a = date.split('-').map(Number);
  const b = today.split('-').map(Number);
  const da = new Date(a[0] ?? 1970, (a[1] ?? 1) - 1, a[2] ?? 1).getTime();
  const db = new Date(b[0] ?? 1970, (b[1] ?? 1) - 1, b[2] ?? 1).getTime();
  const diff = Math.round((da - db) / 86400000);
  if (diff === 0) return t('day.today');
  if (diff === 1) return t('day.tomorrow');
  if (diff === -1) return t('day.yesterday');
  return date;
}

function fmtClock(min: number): string {
  return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
}

function dayIso(d: Date): string {
  const p2 = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
}

function addDaysIso(date: string, n: number): string {
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number);
  return dayIso(new Date(y, m - 1, d + n));
}

function Frame({ title, icon, onClose, children }: { title: string; icon: IconName; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="tg-veil" onClick={onClose} />
      <div className="tg-sheet" role="dialog" aria-label={title}>
        <div className="tg-shead">
          <h3>
            <span className="ic">
              <Icon n={icon} />
            </span>
            {title}
          </h3>
          <button className="tg-dots" onClick={onClose} aria-label={title}>
            <Icon n="x" size={16} />
          </button>
        </div>
        <div className="tg-sbody">{children}</div>
      </div>
    </>
  );
}

/** 全天抽屉 — the day's mini axis, read-only. Ghosts (pending timed proposals)
 *  lane in alongside the real blocks, dashed: they are a "want to put it here?"
 *  until a yes lands them. */
export function PeekSheet({
  t,
  s,
  tz,
  onLedger,
  onOutlook,
  onClose,
}: {
  t: Catalog['t'];
  s: Store;
  /** 会话时区（空=浏览器本地）——现在线与日期头都跟它走。 */
  tz: string;
  onLedger: () => void;
  onOutlook: () => void;
  onClose: () => void;
}) {
  const now = s.tick;
  const blocks = (s.plan?.blocks ?? [])
    .filter((b) => !b.hidden && b.time !== null)
    .sort((a, b) => toMin(a.time ?? '0') - toMin(b.time ?? '0'));
  const ghosts = s.proposals.filter((p) => p.kind === 'timed' && p.start && (!p.date || p.date === s.date));

  type Row = { min: number; node: React.ReactNode };
  const rows: Row[] = blocks.map((b) => {
    const start = toMin(b.time ?? '0');
    const end = start + (b.duration_min ?? 0);
    const isNow = now >= start && now < end && !b.completed;
    const past = end <= now;
    const d = b.completed ? 'done' : isNow ? 'now' : past ? 'miss' : '';
    return {
      min: start,
      node: (
        <div key={'b' + b.id} className={'tg-ax' + (past && !b.completed ? ' past' : '') + (isNow ? ' now' : '')}>
          <span className="tm">{b.time}</span>
          <span className={'d ' + d} />
          <span className="t">
            {b.title}
            {isNow && <span className="tg-qbadge"> · {t('peek.now')}</span>}
          </span>
        </div>
      ),
    };
  });
  for (const p of ghosts) {
    rows.push({
      min: toMin(p.start ?? '0'),
      node: (
        <div key={'g' + p.id} className="tg-ax ghost">
          <span className="tm">{p.start}</span>
          <span className="d" />
          <span className="t">{t('peek.ghost', { title: p.title })}</span>
        </div>
      ),
    });
  }
  rows.sort((a, b) => a.min - b.min);
  const firstFuture = rows.findIndex((r) => r.min > now);

  return (
    <>
      <div className="tg-veil" onClick={onClose} />
      <div className="tg-peek" role="dialog" aria-label={t('peek.title')}>
        <div className="tg-phead">
          <span className="tg-pdate">
            <Icon n="calendar" size={13} />
            {t('peek.dayline', {
              // 原型是「8月14日 周五」：月日一段、星期一段，中间空格 —— 一次
              // Intl 调用在 zh 下不会带这个空格，两段拼。
              date:
                new Intl.DateTimeFormat(document.documentElement.lang || undefined, { month: 'long', day: 'numeric', ...(tz ? { timeZone: tz } : {}) }).format(new Date()) +
                ' ' +
                new Intl.DateTimeFormat(document.documentElement.lang || undefined, { weekday: 'short', ...(tz ? { timeZone: tz } : {}) }).format(new Date()),
            })}
          </span>
          <span className="tg-phint">{t('peek.title')}</span>
        </div>
        <div className="tg-axis">
          {rows.length === 0 && <p className="tg-note">{t('peek.empty')}</p>}
          {rows.slice(0, firstFuture < 0 ? rows.length : firstFuture).map((r) => r.node)}
          <div className="tg-axnow">
            <span className="chip">{t('peek.nowChip', { time: fmtClock(now) })}</span>
            <span className="ln" />
          </div>
          {firstFuture >= 0 && rows.slice(firstFuture).map((r) => r.node)}
        </div>
        <div className="tg-peekfoot">
          <button className="tg-btn sec" onClick={onLedger}>
            <Icon n="undo" size={14} />
            {t('peek.ledger')}
          </button>
          <button className="tg-btn sec" onClick={onOutlook}>
            <Icon n="zap" size={14} />
            {t('peek.outlook')}
          </button>
          <button className="tg-btn ghost" onClick={onClose}>
            <Icon n="chevron-up" size={14} />
            {t('peek.close')}
          </button>
        </div>
      </div>
    </>
  );
}

/** 账本 — the append-only footprint. Every line can be walked back; the walk
 *  back is itself a new line, which is why nothing here is ever deleted. */
export function LedgerSheet({ t, s, onClose }: { t: Catalog['t']; s: Store; onClose: () => void }) {
  const [ops, setOps] = useState<OperationLog[] | null>(null);
  const [busyId, setBusyId] = useState('');
  const load = () => {
    void api.ops(30).then((r) => setOps(r.ops ?? []), () => setOps([]));
  };
  useEffect(load, []);
  const revert = async (id: string) => {
    setBusyId(id);
    try {
      await api.revertOp(id);
      load();
      void s.refresh();
    } finally {
      setBusyId('');
    }
  };
  let lastDay = '';
  return (
    <Frame title={t('peek.ledger')} icon="undo" onClose={onClose}>
      {ops === null && <p className="tg-note">{t('capture.parsing')}</p>}
      {ops !== null && ops.length === 0 && <p className="tg-note">{t('ledger.empty')}</p>}
      {(ops ?? []).map((op) => {
        // The ledger answers "what happened when" — group by the day the op
        // HAPPENED (its createdAt), not the plan date it touched; mixing the
        // two printed two separate "today" headers for one afternoon. And the
        // wire's createdAt is UTC ISO: render the browser's own clock, or the
        // times read five hours off.
        const at = new Date(op.createdAt);
        const p2 = (n: number) => String(n).padStart(2, '0');
        const day = at.getFullYear() + '-' + p2(at.getMonth() + 1) + '-' + p2(at.getDate());
        const head = day !== lastDay ? <div className="tg-cap">{relDay(t, day, s.date)}</div> : null;
        lastDay = day;
        return (
          <div key={op.id}>
            {head}
            <div className="tg-li">
              <span className="tm">
                {p2(at.getHours())}:{p2(at.getMinutes())}
              </span>
              <div className="bd">
                <div className="lb">{op.summary || op.action}</div>
                <div className="sb">{t(op.actor === 'user' ? 'ledger.who.me' : 'ledger.who.ai')}</div>
              </div>
              <button className="un" disabled={busyId === op.id} onClick={() => void revert(op.id)}>
                {t('ledger.undo')}
              </button>
            </div>
          </div>
        );
      })}
      <p className="tg-note">{t('ledger.note')}</p>
    </Frame>
  );
}

/** 展望 · 雷达 — what bears down (assignments) and what calls (wishes). */
export function OutlookSheet({ t, s, onClose }: { t: Catalog['t']; s: Store; onClose: () => void }) {
  const [items, setItems] = useState<Assignment[] | null>(null);
  const [wishes, setWishes] = useState<Wish[] | null>(null);
  const [courseList, setCourseList] = useState<Course[]>([]);
  const load = () => {
    const to = addDaysIso(s.date, 14);
    void api.assignments({ from: s.date, to }).then((r) => setItems(r.assignments ?? []), () => setItems([]));
    void api.wishes('active').then((r) => setWishes(r.wishes ?? []), () => setWishes([]));
    void api.courses().then((r) => setCourseList(r.courses ?? []), () => {});
  };
  useEffect(load, []);
  const setWish = async (w: Wish, status: 'done' | 'archived') => {
    await api.updateWish(w.id, { status }).catch(() => {});
    load();
  };
  // 原型 radar() 的紧迫度（design-ui/core/daycore-core.js）：距截止 <26h 最急
  // （暖色）、<76h 次之、其余灰。按小时算，不是按天——「明早 10 点」和「明晚
  // 23:59」在夜里不该同色。
  const urgencyOf = (dueAt?: string): number => {
    if (!dueAt) return 0;
    const ms = new Date(dueAt).getTime();
    if (Number.isNaN(ms)) return 0;
    const dh = (ms - Date.now()) / 3600e3;
    return dh < 26 ? 2 : dh < 76 ? 1 : 0;
  };
  // 原型 radar() 的截止标签：今天/明天 HH:MM，再远是「周日 8月16日 23:59」——
  // 星期几 + 月日 + 钟点，相对天数（"3 天后"）看不出是上午还是深夜。
  const dueLabel = (dueAt?: string): string => {
    if (!dueAt) return '';
    const d = new Date(dueAt);
    if (Number.isNaN(d.getTime())) return '';
    const lang = document.documentElement.lang || undefined;
    const hm = new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
    const day = dayIso(d);
    if (day === s.date) return t('day.today') + ' ' + hm;
    if (day === addDaysIso(s.date, 1)) return t('day.tomorrow') + ' ' + hm;
    const wd = new Intl.DateTimeFormat(lang, { weekday: 'short' }).format(d);
    const md = new Intl.DateTimeFormat(lang, { month: 'long', day: 'numeric' }).format(d);
    return wd + ' ' + md + ' ' + hm;
  };
  return (
    <Frame title={t('outlook.title')} icon="zap" onClose={onClose}>
      <div className="tg-cap">{t('outlook.radar')}</div>
      {items === null && <p className="tg-note">{t('capture.parsing')}</p>}
      {items !== null && items.length === 0 && <p className="tg-note">{t('outlook.empty')}</p>}
      {(items ?? []).map((a) => {
        const u = urgencyOf(a.dueAt);
        // 课程行是人读的代码（CS 201），不是主键——把 UUID 摆上行是这次
        // 复查抓出来的真 bug。
        const course = a.courseId ? courseList.find((c) => c.id === a.courseId) : undefined;
        return (
          <div key={a.id} className="tg-li">
            <span className="tg-u" data-u={u} />
            <div className="bd">
              <div className="lb">{a.title}</div>
              {course && <div className="sb">{course.courseCode || course.name}</div>}
            </div>
            <span className="sb" style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 650, color: u === 2 ? 'var(--tg-warm)' : 'var(--tg-ink2)' }}>
              {dueLabel(a.dueAt)}
            </span>
          </div>
        );
      })}
      <div style={{ fontSize: 11, color: 'var(--tg-ink3)', margin: '8px 0 4px', textAlign: 'center' }}>{t('outlook.far')}</div>
      <div className="tg-cap">{t('outlook.wishes')}</div>
      {wishes !== null && wishes.length === 0 && <p className="tg-note">{t('outlook.wishEmpty')}</p>}
      {(wishes ?? []).map((w) => (
        <div key={w.id} className="tg-li">
          <span style={{ color: 'var(--tg-warm)', marginTop: 3, display: 'inline-flex' }}>
            <Icon n="star" size={14} />
          </span>
          <div className="bd">
            <div className="lb">{w.title}</div>
            <div className="sb">{w.effortMin ? t('outlook.wishEffort', { n: w.effortMin }) + t('outlook.wishTail') : t('outlook.wishTailBare')}</div>
          </div>
          <button className="un" style={{ color: 'var(--tg-accent)' }} onClick={() => void setWish(w, 'done')}>
            {t('outlook.done')}
          </button>
          <button className="un" style={{ color: 'var(--tg-ink3)' }} onClick={() => void setWish(w, 'archived')}>
            {t('outlook.drop')}
          </button>
        </div>
      ))}
    </Frame>
  );
}

/** 心情打卡 — the mood catalog is the SERVER's (GET /api/mood/kinds, emoji and
 *  localized names included); a hardcoded frontend list would drift from what
 *  POST /api/mood accepts ("unknown_mood" 400 if it did). One tap, gone. */
export function MoodSheet({ t, s, onClose }: { t: Catalog['t']; s: Store; onClose: () => void }) {
  const [kinds, setKinds] = useState<api.MoodKind[] | null>(null);
  useEffect(() => {
    void api.moodKinds().then((r) => setKinds(r.kinds ?? []), () => setKinds([]));
  }, []);
  // 原型（ting-parts.jsx 的 QUICK_MOODS）在汀只放六张快脸 ——「一次点选就够」。
  // 词表仍是服务端的十二种，这里只决定呈现哪几个 id；其余心情照旧能从
  // 「说一句」和陪伴里记下来。
  const QUICK = ['happy', 'calm', 'excited', 'neutral', 'tired', 'stressed'];
  return (
    <Frame title={t('mood.title')} icon="smile" onClose={onClose}>
      <p className="tg-note" style={{ margin: '2px 0 10px' }}>{t('mood.sub')}</p>
      {kinds === null && <p className="tg-note">{t('capture.parsing')}</p>}
      <div className="tg-moodrow">
        {(kinds ?? []).filter((k) => QUICK.includes(k.id)).map((k) => (
          <button
            key={k.id}
            disabled={s.busy}
            onClick={() => {
              void s.recordMood(k.id, k.name).then((ok) => ok && onClose());
            }}
          >
            <span className="e">{k.emoji}</span>
            {k.name}
          </button>
        ))}
      </div>
      <div className="tg-actrow" style={{ justifyContent: 'center' }}>
        <button className="tg-btn ghost" onClick={onClose}>
          {t('mood.skip')}
        </button>
      </div>
    </Frame>
  );
}

/** 追问 — why this arrangement. 汀 deliberately keeps no chat history; this
 *  sheet surfaces what the card itself carried (reason + evidence) and points
 *  at the companion elsewhere, exactly as the prototype does. */
export function WhySheet({ t, p, onClose }: { t: Catalog['t']; p: Proposal; onClose: () => void }) {
  return (
    <Frame title={t('why.title')} icon="eye" onClose={onClose}>
      <div className="tg-cap">{p.title}</div>
      {p.reason && <p className="tg-note">{p.reason}</p>}
      {p.evidence && <p className="tg-note">{p.evidence}</p>}
      {!p.reason && !p.evidence && <p className="tg-note">{t('why.empty')}</p>}
      <p className="tg-note">{t('why.note')}</p>
    </Frame>
  );
}
