import type { Catalog, CustomTheme } from '@daycore/core';
import { BUILTIN_THEMES } from './theme';

// The menu sheet — 汀's only settings surface. The prototype keeps it to three
// things: the water (theme), the language, and what 汀 is. That economy is the
// point of this end; everything else lives in the peek or the ledger.
export function MenuSheet({
  t,
  themeId,
  themes,
  onTheme,
  locale,
  locales,
  onLocale,
  onClose,
}: {
  t: Catalog['t'];
  themeId: string;
  themes: CustomTheme[];
  onTheme: (id: string) => void;
  locale: string;
  locales: string[];
  onLocale: (locale: string) => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="tg-veil" onClick={onClose} />
      <div className="tg-sheet" role="dialog" aria-label={t('menu.title')}>
        <div className="tg-shead">
          <h3>{t('menu.title')}</h3>
        </div>
        <div className="tg-sbody">
          <div className="tg-cap">{t('menu.theme')}</div>
          <div className="tg-seg">
            {BUILTIN_THEMES.map((id) => (
              <button key={id} className={themeId === id ? 'on' : ''} onClick={() => onTheme(id)}>
                {t(id === 'night' ? 'theme.night' : 'theme.dawn')}
              </button>
            ))}
          </div>
          {themes.length > 0 && (
            <div className="tg-rows">
              {themes.map((th) => (
                <button
                  key={th.id}
                  className={'tg-row' + (themeId === th.id ? ' acc' : '')}
                  onClick={() => onTheme(th.id)}
                >
                  <span className="lb">{th.name}</span>
                  <span className="tg-qbadge">{t(th.dark ? 'theme.dark' : 'theme.light')}</span>
                </button>
              ))}
            </div>
          )}
          <div className="tg-cap">{t('menu.language')}</div>
          <select
            className="tg-select"
            value={locale}
            aria-label={t('menu.language')}
            onChange={(e) => onLocale(e.target.value)}
          >
            {locales.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <p className="tg-note">{t('menu.tagline')}</p>
        </div>
      </div>
    </>
  );
}
