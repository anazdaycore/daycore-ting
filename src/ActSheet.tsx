import type { Catalog, TimeBlock } from '@daycore/core';
import type { Store } from './store';

// 没做 / 换一个… — the way OUT of the current block. Every dead end here gets a
// side exit, which is tone rule ⑥: a 409 from the plan gate renders as its
// message PLUS the actions that still work (unlock / conflict / refish), never
// as a bare "cannot".
export function ActSheet({ t, s, block, onClose }: { t: Catalog['t']; s: Store; block: TimeBlock; onClose: () => void }) {
  const g = s.gate;
  const isTask = block.type === 'task';
  return (
    <>
      <div className="tg-veil" onClick={onClose} />
      <div className="tg-sheet" role="dialog" aria-label={block.title}>
        <div className="tg-shead">
          <h3>{block.title}</h3>
        </div>
        <div className="tg-sbody">
          <button
            className="tg-menuitem"
            disabled={s.busy}
            onClick={() => {
              void s.markMissed(block).then((ok) => ok && onClose());
            }}
          >
            <span className="ic">−</span>
            {t('act.missed')}
          </button>
          <button
            className="tg-menuitem"
            disabled={s.busy}
            onClick={() => {
              void s.pushTomorrow(block).then((ok) => ok && onClose());
            }}
          >
            <span className="ic">→</span>
            {t('act.push')}
          </button>
          <button
            className="tg-menuitem"
            disabled={s.busy}
            onClick={() => {
              void s.remove(block).then((ok) => ok && onClose());
            }}
          >
            <span className="ic">×</span>
            {t('act.remove')}
          </button>

          {g && (
            <>
              <p className="tg-note">{g.message}</p>
              <div className="tg-rows">
                {(g.code === 'locked' || g.code === 'petrified') && (
                  <button
                    className="tg-row"
                    disabled={s.busy}
                    onClick={() => {
                      void s.conflict(block).then((ok) => ok && onClose());
                    }}
                  >
                    <span className="lb">{t('act.conflict')}</span>
                  </button>
                )}
                {g.code === 'locked' && (
                  <button
                    className="tg-row"
                    disabled={s.busy}
                    onClick={() => {
                      void s.unlock(block).then((ok) => ok && onClose());
                    }}
                  >
                    <span className="lb">{t('act.unlock')}</span>
                  </button>
                )}
                {g.code === 'petrified' && isTask && (
                  <button
                    className="tg-row"
                    disabled={s.busy}
                    onClick={() => {
                      const [y = 1970, m = 1, d = 1] = s.date.split('-').map(Number);
                      const dt = new Date(y, m - 1, d + 1);
                      const p = (n: number) => String(n).padStart(2, '0');
                      const tmr = `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
                      void s.refish(block, tmr).then((ok) => ok && onClose());
                    }}
                  >
                    <span className="lb">{t('act.refish')}</span>
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
