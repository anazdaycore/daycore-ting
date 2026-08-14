import type { Catalog, CustomTheme } from '@daycore/core';
import { BUILTIN_THEMES, themeAttribute } from './theme';
import { Icon } from './Icon';

// The menu sheet — 汀's only settings surface. The prototype keeps it to three
// things: the water (theme), the language, and what 汀 is. That economy is the
// point of this end; everything else lives in the peek or the ledger.
/** 主题名的完整字面量表：汀的水色 seg 只渲染夜汀/晨汀两个，但后端内置主题
 *  是 sky/sunset/night/nature 四个——会话带着其中任何一个进来时，seg 通过
 *  themeAttribute 落灯到等效水色，名字也得有处可寻（后端 theme 测试要求每
 *  个内置 id 在语言包里有名，这里的三元链同时满足 i18n 门的字面量要求）。 */
function themeLabel(t: Catalog['t'], id: string): string {
  return id === 'night'
    ? t('theme.night')
    : id === 'dawn'
      ? t('theme.dawn')
      : id === 'sky'
        ? t('theme.sky')
        : id === 'sunset'
          ? t('theme.sunset')
          : id === 'nature'
            ? t('theme.nature')
            : id;
}

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
  // The session can hold a theme id from the shared backend set that 汀 does
  // not render (e.g. 'sky') — themeAttribute() already maps it onto 夜汀 for the
  // actual palette; the seg must light the SAME effective choice, otherwise the
  // water row looks unanswered.
  const segOn = themeAttribute(themeId, themes);
  return (
    <>
      <div className="tg-veil" onClick={onClose} />
      <div className="tg-sheet" role="dialog" aria-label={t('menu.title')}>
        <div className="tg-shead">
          <h3>
            <span className="ic">
              <Icon n="moon" />
            </span>
            {t('menu.title')}
          </h3>
          <button className="tg-dots" onClick={onClose} aria-label={t('peek.close')}>
            <Icon n="x" size={16} />
          </button>
        </div>
        <div className="tg-sbody">
          <div className="tg-cap">{t('menu.theme')}</div>
          <div className="tg-seg">
            {BUILTIN_THEMES.map((id) => (
              <button key={id} className={segOn === id ? 'on' : ''} onClick={() => onTheme(id)}>
                {themeLabel(t, id)}
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
