import { useEffect, useState } from 'react';
import { progressPct, toHM, toMin, nowMin } from './flow';
import { useStore } from './store';
import { MenuSheet } from './MenuSheet';
import { CaptureSheet } from './CaptureSheet';
import { ActSheet } from './ActSheet';
import { LedgerSheet, MoodSheet, OutlookSheet, PeekSheet, WhySheet } from './Sheets';
import { Icon } from './Icon';
import { applyTheme } from './theme';
import { FAMILY_ID } from './manifest';
import * as api from '@daycore/core';
import type { Boot, CustomTheme } from '@daycore/core';

// The single-piece flow. 画面永远只回答一个问题：现在做什么。
//
// Three faces, in priority order — proposal, current block, and the several
// kinds of nothing. The prototype (design-ui/ting) also has a brief face and a
// mood frame; those need endpoints 汀 does not call yet and are deliberately
// left out rather than faked, because a face wired to a mock is a face that
// will be rewritten.

/**
 * Render a translated string that contains line breaks.
 *
 * ⚠️ The break is part of the TRANSLATION, not of the markup. 「现在空着，\n空着
 * 不是欠着。」 breaks where Chinese wants it to; an English translation of the
 * same idea breaks somewhere else, or not at all. A <br/> hardcoded in JSX
 * forces every language to break where Chinese does.
 */
function Lines({ text }: { text: string }) {
  const parts = text.split('\n');
  return (
    <>
      {parts.map((line, i) => (
        <span key={i}>
          {line}
          {i < parts.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}

function useSwipe(onUp: () => void, onLeft?: () => void, onDown?: () => void) {
  const [d, setD] = useState({ x: 0, y: 0 });
  const down = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button,input')) return;
    const x0 = e.clientX;
    const y0 = e.clientY;
    const mv = (ev: PointerEvent) => setD({ x: ev.clientX - x0, y: Math.min(0, ev.clientY - y0) });
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', up);
      const dy = ev.clientY - y0;
      const dx = ev.clientX - x0;
      setD({ x: 0, y: 0 });
      if (dy < -90) onUp();
      else if (onLeft && dx < -90) onLeft();
      else if (onDown && dy > 90) onDown();
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', up);
  };
  const style: React.CSSProperties = {
    transform: `translate(${d.x}px, ${d.y}px)`,
    opacity: 1 + d.y / 260,
    transition: d.x || d.y ? 'none' : 'transform .25s cubic-bezier(.22,.9,.24,1), opacity .25s',
  };
  return [style, down, d] as const;
}

export function App({ boot }: { boot: Boot }) {
  // The catalogue is STATE, not a boot constant: the menu sheet can switch the
  // language mid-session, and every label — including the ones inside the
  // store's undo bar — follows without a reload.
  const [cat, setCat] = useState(boot.catalog);
  const t = cat.t;
  const s = useStore(cat);
  const [clock, setClock] = useState(() => nowMin());
  useEffect(() => {
    const t = setInterval(() => setClock(nowMin()), 30_000);
    return () => clearInterval(t);
  }, []);

  const [sheet, setSheet] = useState<'menu' | 'capture' | 'act' | 'peek' | 'ledger' | 'outlook' | 'why' | 'mood' | null>(null);
  const [whyProp, setWhyProp] = useState<api.Proposal | null>(null);
  // 顶栏账本入口的计数是原型语义：「悄悄做了 N 件」= 今天 actor=agent 的
  // 操作数（L0 安静自动化在账本上留下的行）。不是「今天完成 x/y」——汀
  // 不给完成率站台，那是积债语气的入口。
  const [quietCount, setQuietCount] = useState(0);
  useEffect(() => {
    let live = true;
    void api.ops(50).then(
      (r) => {
        if (!live) return;
        const p2 = (n: number) => String(n).padStart(2, '0');
        const now = new Date();
        const today = now.getFullYear() + '-' + p2(now.getMonth() + 1) + '-' + p2(now.getDate());
        setQuietCount(
          (r.ops ?? []).filter((o) => {
            if (o.actor !== 'agent') return false;
            const at = new Date(o.createdAt);
            return at.getFullYear() + '-' + p2(at.getMonth() + 1) + '-' + p2(at.getDate()) === today;
          }).length,
        );
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);
  const [themeList, setThemeList] = useState<CustomTheme[]>([]);
  const [themeId, setThemeId] = useState(api.themeForFamily(boot.session, FAMILY_ID) || 'night');
  useEffect(() => {
    let live = true;
    void api.themes().then(
      (th) => {
        if (live) setThemeList(th.themes ?? []);
      },
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);

  const chooseTheme = (id: string) => {
    setThemeId(id);
    applyTheme(id, themeList);
    void api.setTheme(id).catch(() => {});
  };

  const chooseLanguage = (locale: string) => {
    api.chooseLocale(locale);
    const avail = boot.availableLocales.length ? boot.availableLocales : ['zh-CN'];
    void api.loadCatalog(locale, avail, avail[0] ?? 'zh-CN').then(setCat);
    void api.patchSettings({ language: locale }).catch(() => {});
  };

  const prop = s.proposals[0] ?? null;
  const cur = s.flow.current;

  const primary = () => {
    // ⚠️ A compound card is NOT accepted by the primary gesture. The server
    // reads the choice as a row id, so a blanket "accept" settles the card
    // without running anything it offered — the swipe would look like it worked
    // and change nothing. The rows are on screen as buttons instead.
    if (prop) {
      if (!prop.rows?.length) void s.answer(prop, true);
      return;
    }
    if (cur) void s.complete(cur);
  };
  const secondary = () => {
    if (prop) void s.answer(prop, false);
  };

  // The TTL line says which default silence signs — silence_accepts or
  // silence_rejects — and how long is left. "Ignoring is always safe" is a
  // promise; hiding the default would break it.
  let ttlText: string | null = null;
  if (prop?.expiresAt) {
    const ms = Date.parse(prop.expiresAt) - Date.now();
    if (ms > 0) {
      const h = ms / 3600e3;
      const left = h >= 1 ? Math.round(h) + 'h' : Math.max(5, Math.round(h * 60)) + 'm';
      ttlText = t(prop.ttlPolicy === 'silence_accepts' ? 'prop.ttlAccept' : 'prop.ttlReject', { left });
    }
  }

  // Desktop drives on the keyboard, not on swipes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'Enter' || e.key === 'ArrowUp') {
        e.preventDefault();
        primary();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSheet('peek');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        // An open surface folds first; the proposal's "no" is only the
        // fallback when nothing is covering the screen.
        if (sheet) setSheet(null);
        else secondary();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  // 下滑 = 全天抽屉 on every face — the gesture map is one of the product's
  // invariants (up = the main action, down = the day, left = push away).
  const [propStyle, propDown, propD] = useSwipe(
    () => primary(),
    () => prop && s.answer(prop, false),
    () => setSheet('peek'),
  );
  const [curStyle, curDown] = useSwipe(() => cur && s.complete(cur), undefined, () => setSheet('peek'));

  return (
    <div className="tg-app">
      <div className="tg-frame">
        {s.undo && (
          <div className="tg-undo">
            <span>{s.undo.label}</span>
            <button onClick={() => void s.takeBack()}>{t('undo.take')}</button>
            <button className="x" onClick={() => s.dismissUndo()} aria-label={t('undo.dismiss')}>
              ✕
            </button>
          </div>
        )}

        <header className="tg-top">
          <span className="tg-clock">{toHM(clock)}</span>
          <button className="tg-l0" onClick={() => setSheet('ledger')} aria-label={t('peek.ledger')}>
            {t('top.l0', { n: quietCount })}
          </button>
          <button className="tg-dots" onClick={() => setSheet('mood')} aria-label={t('mood.open')}>
            <Icon n="smile" size={17} />
          </button>
          <button className="tg-dots" onClick={() => setSheet('menu')} aria-label={t('menu.open')}>
            <Icon n="dots" size={18} />
          </button>
        </header>

        <div className="tg-handle" onClick={() => setSheet('peek')}>
          <span className="bar" />
          {t('peek.hint')}
        </div>

        <div className="tg-main">
          {s.error && <p className="tg-note">{s.error}</p>}

          {prop ? (
            <div className="tg-card tg-prop" onPointerDown={propDown} style={propStyle}>
              {ttlText && <span className="ttl">{ttlText}</span>}
              <div className="tg-eyebrow">
                <span>{t(prop.level === 'L3' ? 'prop.eyebrow.urgent' : 'prop.eyebrow')}</span>
                <i className="ln" />
                {s.proposals.length > 1 && (
                  <span className="tg-qbadge">{t('prop.queue', { n: s.proposals.length - 1 })}</span>
                )}
              </div>
              <h1 className="tg-title md">{prop.title}</h1>
              {(prop.summary || prop.reason) && (
                <p className="why">
                  {prop.summary}
                  {prop.summary && prop.reason ? '——' : ''}
                  {prop.reason ?? ''}
                </p>
              )}
              {prop.start && (
                <div className="tg-metarow">
                  <span>
                    {prop.start}
                    {prop.dur ? '–' + toHM(toMin(prop.start) + prop.dur) : ''}
                  </span>
                </div>
              )}
              {prop.evidence && (
                <div className="ev">
                  <Icon n="eye" size={12} />
                  {prop.evidence}
                </div>
              )}
              {prop.rows?.length ? (
                <div className="tg-rows">
                  {prop.rows.map((row) => (
                    <div key={row.id} className={'tg-row' + (row.state === 'accepted' ? ' acc' : row.state === 'rejected' ? ' rej' : '')}>
                      <span className="lb">{row.label}</span>
                      {/* ⚠️ The wire can accept one row (choice=rowID, the others
                          settle as rejected) or reject the whole card — there is
                          no per-row reject. So each row gets the round ✓ only;
                          "no to all of them" is the card-level 推开 below. */}
                      <button className="rb y" disabled={s.busy} aria-label={row.label} onClick={() => void s.take(prop, row.id)}>
                        <Icon n="check" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="tg-actrow">
                {/* ⚠️ A compound card is a menu, and 汀's gestures cannot express
                    "which row" — a swipe is one bit. So the rows are buttons and
                    the accept gesture is disabled for those cards (see primary()
                    below); rejecting stays available either way, because "no" is
                    unambiguous whatever the card's shape. */}
                {prop.rows?.length
                  ? null
                  : (
                      <button className="tg-btn pri" disabled={s.busy} onClick={() => void s.answer(prop, true)}>
                        {t('prop.accept')}
                      </button>
                    )}
                <button className="tg-btn sec" disabled={s.busy} onClick={() => void s.answer(prop, false)}>
                  {t('prop.reject')}
                </button>
                <button
                  className="tg-btn ghost"
                  onClick={() => {
                    setWhyProp(prop);
                    setSheet('why');
                  }}
                >
                  {t('prop.followUp')}
                </button>
                <button className="tg-btn ghost" onClick={() => s.skipAll()}>
                  {t('prop.skipAll')}
                </button>
              </div>
              <div className="tg-sidecue l" style={{ opacity: propD.x < -30 ? 1 : 0 }}>
                {t('prop.cue.reject')}
              </div>
              <div className="tg-sidecue r" style={{ opacity: propD.x > 30 ? 1 : 0 }}>
                {t('prop.cue.accept')}
              </div>
            </div>
          ) : cur ? (
            <div className="tg-card" onPointerDown={curDown} style={curStyle}>
              <div className="tg-eyebrow">
                <span>
                  {t('now.eyebrow', {
                    span:
                      cur.time +
                      (cur.duration_min ? '–' + toHM(toMin(cur.time!) + cur.duration_min) : ''),
                  })}
                </span>
                <i className="ln" />
                {cur.duration_min ? <span className="tg-qbadge">{progressPct(cur, clock)}%</span> : null}
              </div>
              <h1 className="tg-title">{cur.title}</h1>
              {cur.note && <p className="tg-note">“{cur.note}”</p>}
              <div className="tg-metarow">
                <span className={'tg-origin ' + (cur.origin ?? 'manual')}>
                  {t(cur.origin === 'manual' ? 'now.origin.manual' : 'now.origin.auto')}
                </span>
                {cur.duration_min ? (
                  <span>
                    {t('now.remaining', {
                      n: Math.max(0, toMin(cur.time!) + cur.duration_min - clock),
                    })}
                  </span>
                ) : null}
              </div>
              {cur.duration_min ? (
                <div className="tg-prog">
                  <i style={{ width: progressPct(cur, clock) + '%' }} />
                </div>
              ) : null}
              <div className="tg-actrow">
                <button className="tg-btn pri" disabled={s.busy} onClick={() => void s.complete(cur)}>
                  {t('now.complete')}
                </button>
                <button className="tg-btn sec" disabled={s.busy} onClick={() => setSheet('act')}>
                  {t('act.open')}
                </button>
              </div>
            </div>
          ) : s.flow.next && !s.flow.nextTomorrow ? (
            <div className="tg-card">
              <div className="tg-eyebrow mute">
                <span>{t('gap.eyebrow')}</span>
                <i className="ln" />
              </div>
              <h1 className="tg-title md">
                <Lines text={t('gap.title')} />
              </h1>
              <p className="tg-sub">{t('gap.body', { n: s.flow.gapMin })}</p>
              <div className="tg-actrow">
                <button className="tg-btn pri" onClick={() => setSheet('capture')}>
                  {t('caps.say')}
                </button>
              </div>
            </div>
          ) : s.flow.nextTomorrow ? (
            <div className="tg-card">
              <div className="tg-eyebrow mute">
                <span>{t('done.eyebrow')}</span>
                <i className="ln" />
              </div>
              <h1 className="tg-title md">
                <Lines text={t('done.title')} />
              </h1>
              <p className="tg-sub">{t('done.body')}</p>
              <div className="tg-actrow">
                <button className="tg-btn pri" onClick={() => setSheet('capture')}>
                  {t('caps.say')}
                </button>
              </div>
            </div>
          ) : (
            <div className="tg-card">
              <div className="tg-eyebrow mute">
                <span>{t('empty.eyebrow')}</span>
                <i className="ln" />
              </div>
              <h1 className="tg-title md">
                <Lines text={t('empty.title')} />
              </h1>
              <p className="tg-sub">{t('empty.body')}</p>
              <div className="tg-actrow">
                <button className="tg-btn pri" onClick={() => setSheet('capture')}>
                  {t('caps.say')}
                </button>
              </div>
            </div>
          )}

          {(prop || cur) && (
            <div className="tg-swipehint">
              <span className="up">↑</span>
              <span>{t(prop ? 'swipe.accept' : 'swipe.complete')}</span>
            </div>
          )}
        </div>

        {(prop || cur) && (
          // ⚠️ Must sit OUTSIDE .tg-main: that container is position:relative and
          // only as tall as the face, so bottom:86px landed the hint row on top
          // of the proposal card's own buttons. Anchored to .tg-app it floats
          // above the next-bar, where the keyboard driver actually looks.
          <div className="tg-keyhint">
            <kbd>↵</kbd>
            {t('keyhint.accept')}
            <kbd>esc</kbd>
            {t('keyhint.reject')}
            <kbd>↓</kbd>
            {t('keyhint.peek')}
          </div>
        )}

        {s.flow.next && (
          <div className="tg-next" onClick={() => setSheet('peek')}>
            <span className="k">{t(s.flow.nextTomorrow ? 'foot.nextTmr' : 'foot.next')}</span>
            <span className="t">{s.flow.next.title}</span>
            <span className="tm">{s.flow.next.time}</span>
          </div>
        )}
        <footer className="tg-foot">
          <div className="tg-caps" onClick={() => setSheet('capture')}>
            {t('caps.hint')}
            <span className="mic">
              <Icon n="chat" size={16} />
            </span>
          </div>
        </footer>
        {sheet === 'menu' && (
          <MenuSheet
            t={t}
            themeId={themeId}
            themes={themeList}
            onTheme={chooseTheme}
            locale={cat.locale}
            locales={boot.availableLocales}
            onLocale={chooseLanguage}
            onClose={() => setSheet(null)}
          />
        )}
        {sheet === 'capture' && (
          <CaptureSheet
            t={t}
            date={s.date}
            busy={s.busy}
            onConfirm={s.capture}
            onClose={() => setSheet(null)}
          />
        )}
        {sheet === 'act' && cur && <ActSheet t={t} s={s} block={cur} onClose={() => setSheet(null)} />}
        {sheet === 'peek' && (
          <PeekSheet
            t={t}
            s={s}
            onLedger={() => setSheet('ledger')}
            onOutlook={() => setSheet('outlook')}
            onClose={() => setSheet(null)}
          />
        )}
        {sheet === 'ledger' && <LedgerSheet t={t} s={s} onClose={() => setSheet(null)} />}
        {sheet === 'outlook' && <OutlookSheet t={t} s={s} onClose={() => setSheet(null)} />}
        {sheet === 'why' && whyProp && <WhySheet t={t} p={whyProp} onClose={() => setSheet(null)} />}
        {sheet === 'mood' && <MoodSheet t={t} s={s} onClose={() => setSheet(null)} />}
      </div>
    </div>
  );
}
