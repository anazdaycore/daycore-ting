import { useState } from 'react';
import * as api from '@daycore/core';
import { Icon } from './Icon';
import type { Catalog, TimeBlock } from '@daycore/core';

// 说一句 — the capture capsule's sheet. Free text goes to plan-text; what comes
// back is CANDIDATES, not blocks: the reader ticks the ones that heard right
// and only those land in the day. A 200 with {error} is the model declining
// ("nothing here to plan from" is an answer), so it renders as a sentence,
// not a thrown fault.
export function CaptureSheet({
  t,
  date,
  busy,
  onConfirm,
  onClose,
}: {
  t: Catalog['t'];
  date: string;
  busy: boolean;
  onConfirm: (blocks: TimeBlock[]) => Promise<boolean>;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<'edit' | 'parsing' | 'candidates'>('edit');
  const [cands, setCands] = useState<TimeBlock[]>([]);
  const [checked, setChecked] = useState<ReadonlySet<number>>(new Set());
  const [err, setErr] = useState('');

  const submit = async (q?: string) => {
    const v = (q ?? text).trim();
    if (!v) return;
    setPhase('parsing');
    setErr('');
    try {
      const r = await api.planFromText({
        description: v,
        date,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (r.error) {
        setErr(r.message || r.error);
        setPhase('edit');
        return;
      }
      const blocks = (r.blocks ?? []).filter((b) => !b.hidden);
      if (!blocks.length) {
        setErr(t('capture.empty'));
        setPhase('edit');
        return;
      }
      setCands(blocks);
      setChecked(new Set(blocks.map((_, i) => i)));
      setPhase('candidates');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setPhase('edit');
    }
  };

  const toggle = (i: number) => {
    const next = new Set(checked);
    if (next.has(i)) next.delete(i);
    else next.add(i);
    setChecked(next);
  };

  const confirm = async () => {
    const chosen = cands.filter((_, i) => checked.has(i));
    if (!chosen.length) {
      onClose();
      return;
    }
    if (await onConfirm(chosen)) onClose();
  };

  return (
    <>
      <div className="tg-veil" onClick={onClose} />
      <div className="tg-sheet" role="dialog" aria-label={t('capture.title')}>
        <div className="tg-shead">
          <h3>
            <span className="ic">
              <Icon n="chat" />
            </span>
            {t('capture.title')}
          </h3>
          <button className="tg-dots" onClick={onClose} aria-label={t('peek.close')}>
            <Icon n="x" size={16} />
          </button>
        </div>
        <div className="tg-sbody">
          {phase !== 'candidates' ? (
            <>
              <div className="tg-inrow">
                <input
                  autoFocus
                  value={text}
                  placeholder={t('capture.placeholder')}
                  aria-label={t('capture.placeholder')}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') void submit();
                  }}
                />
                <button
                  className="tg-btn pri"
                  style={{ width: 46, padding: 0, borderRadius: 14, flex: 'none' }}
                  disabled={phase === 'parsing'}
                  aria-label={t('capture.send')}
                  onClick={() => void submit()}
                >
                  <Icon n="send" size={17} />
                </button>
              </div>
              <div className="tg-quick">
                {[1, 2, 3].map((n) => (
                  <button key={n} disabled={phase === 'parsing'} onClick={() => void submit(t(n === 1 ? 'capture.quick.1' : n === 2 ? 'capture.quick.2' : 'capture.quick.3'))}>
                    {t(n === 1 ? 'capture.quick.1' : n === 2 ? 'capture.quick.2' : 'capture.quick.3')}
                  </button>
                ))}
              </div>
              {phase === 'parsing' && <p className="tg-note">{t('capture.parsing')}</p>}
              {err && <p className="tg-note">{err}</p>}
              <p className="tg-note">{t('capture.hint')}</p>
            </>
          ) : (
            <>
              <div className="tg-cap">{t('capture.pick')}</div>
              <div className="tg-rows">
                {cands.map((b, i) => (
                  <button key={i} className={'tg-row' + (checked.has(i) ? ' acc' : '')} onClick={() => toggle(i)}>
                    <span className="lb">
                      {b.time ? b.time + ' · ' : ''}
                      {b.title}
                      {b.duration_min ? ' · ' + b.duration_min + 'min' : ''}
                    </span>
                    <span className={'rb' + (checked.has(i) ? ' y' : ' n')}>{checked.has(i) ? '✓' : '×'}</span>
                  </button>
                ))}
              </div>
              <div className="tg-actrow">
                <button className="tg-btn pri" disabled={busy} onClick={() => void confirm()}>
                  {t('capture.confirm', { n: checked.size })}
                </button>
                <button className="tg-btn sec" onClick={onClose}>
                  {t('capture.later')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
