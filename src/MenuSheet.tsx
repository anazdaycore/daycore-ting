import { useEffect, useState } from 'react';
import * as api from '@daycore/core';
import type { Catalog, CustomTheme, Rhythm, User } from '@daycore/core';
import { BUILTIN_THEMES, themeAttribute } from './theme';
import { Icon } from './Icon';

/** 账户 — the quiet top of the menu. Anonymous is a first-class state with its
 *  own line ("data lives on this device"), not an error page. Login/register is
 *  one form with a toggle; success reloads so the merged user session boots
 *  clean (the backend folds the anonymous session into the user's on auth). */
function AccountBlock({
  t,
  mode,
  onMode,
  onBusy,
}: {
  t: Catalog['t'];
  mode: 'none' | 'login' | 'register';
  onMode: (m: 'none' | 'login' | 'register') => void;
  onBusy: (b: boolean) => void;
}) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void api.me().then((r) => setUser(r.user), () => setUser(null));
  }, []);
  const submit = () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) { setErr(t('auth.errEmail')); return; }
    if (f.password.length < 8) { setErr(t('auth.errPassword')); return; }
    setErr('');
    setBusy(true);
    onBusy(true);
    void (mode === 'register' ? api.register(f.email, f.password, f.name.trim() || undefined) : api.login(f.email, f.password)).then(
      () => location.reload(),
      () => { setBusy(false); onBusy(false); setErr(t('auth.failed')); },
    );
  };
  const signOut = () => {
    setBusy(true);
    onBusy(true);
    void api.logout().then(() => location.reload(), () => { setBusy(false); onBusy(false); });
  };

  if (mode !== 'none') {
    return (
      <>
        <div className="tg-cap">{t(mode === 'login' ? 'auth.signin' : 'auth.register')}</div>
        {mode === 'register' && (
          <input className="tg-input" style={{ marginBottom: 8 }} placeholder={t('auth.namePh')} aria-label={t('auth.name')}
            value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        )}
        <input className="tg-input" style={{ marginBottom: 8 }} type="email" placeholder="you@school.edu" aria-label={t('auth.email')}
          value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input className="tg-input" type="password" placeholder={t('auth.passwordPh')} aria-label={t('auth.password')}
          value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && submit()} />
        {err && <p className="tg-note" style={{ marginTop: 8 }}>{err}</p>}
        <div className="tg-actrow">
          <button className="tg-btn pri" disabled={busy} onClick={submit}>
            {t(mode === 'login' ? 'auth.submitLogin' : 'auth.submitRegister')}
          </button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 10 }}>
          <button className="un" onClick={() => { onMode(mode === 'login' ? 'register' : 'login'); setErr(''); }}>
            {t(mode === 'login' ? 'auth.toRegister' : 'auth.toLogin')}
          </button>
        </div>
      </>
    );
  }
  return (
    <>
      <div className="tg-cap">{t('menu.account')}</div>
      <div className="tg-li">
        <span className="ic" style={{ color: 'var(--tg-accent)', marginTop: 3, display: 'inline-flex' }}>
          <Icon n="smile" size={13} />
        </span>
        <div className="bd">
          <div className="lb">{user ? (user.name || user.email || '') : t('auth.anon')}</div>
          <div className="sb">{user ? (user.email ?? '') + ' · ' + t('auth.synced') : t('auth.anonSub')}</div>
        </div>
        {user ? (
          <button className="un" disabled={busy} onClick={signOut}>{t('auth.signout')}</button>
        ) : (
          <button className="un" style={{ color: 'var(--tg-accent)' }} disabled={busy || user === undefined} onClick={() => onMode('login')}>
            {t('auth.enter')}
          </button>
        )}
      </div>
    </>
  );
}

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
  // 节律行：原型从 mock state 读，落地读 GET /api/v2/rhythm（core rhythm()）。
  // 服务端学不出来时回 cold 默认（source:'default'）——照播，行尾的语气说明
  // 比数字本身更是这行的存在理由。
  const [rhythm, setRhythm] = useState<Rhythm | null>(null);
  const [authMode, setAuthMode] = useState<'none' | 'login' | 'register'>('none');
  const [authBusy, setAuthBusy] = useState(false);
  useEffect(() => {
    void api.rhythm().then(setRhythm, () => setRhythm(null));
  }, []);
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
          <AccountBlock t={t} mode={authMode} onMode={setAuthMode} onBusy={setAuthBusy} />
          {authMode === 'none' && !authBusy && (
          <>
          <div className="tg-cap">{t('menu.theme')}</div>
          <div className="tg-seg">
            {BUILTIN_THEMES.map((id) => (
              <button key={id} className={segOn === id ? 'on' : ''} onClick={() => onTheme(id)}>
                {themeLabel(t, id)}
              </button>
            ))}
          </div>
          {rhythm && (
            <div className="tg-li">
              <span className="ic" style={{ color: 'var(--tg-accent)', marginTop: 3, display: 'inline-flex' }}>
                <Icon n="moon" size={13} />
              </span>
              <div className="bd">
                <div className="lb">{t('menu.rhythm', { sleep: rhythm.sleep, wake: rhythm.wake })}</div>
                <div className="sb">{t('menu.rhythmSub')}</div>
              </div>
            </div>
          )}
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
          </>
          )}
        </div>
      </div>
    </>
  );
}
