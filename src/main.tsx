import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './theme.css';
import { App } from './App';
import { Setting } from './Setting';
import { boot as bootUp, type Boot } from '@daycore/core';
import { isFirstRun } from '@daycore/core';
import { bootstrapCatalog, type Catalog } from '@daycore/core';
import { FAMILY_ID, manifest } from './manifest';
import { applyTheme } from './theme';

// ⚠️ The packs 汀 SHIPS, in public/locales/. Passed in rather than read from
// @daycore/core, because each of the four frontends ships a different set — a
// constant in the shared package would be one frontend's answer imposed on the
// other three.
const SHIPPED = ['zh-CN', 'en-US'];
import * as api from '@daycore/core';

// ⚠️ The setting screen comes BEFORE the boot attempt on a fresh install, and
// after a failed one otherwise. Both directions matter: a first-run install has
// no address to try, and a broken address must lead back to the field that
// fixes it rather than to a dead screen with a reload button.
//
// ⚠️ Two catalogues, and the split is not incidental. `bootCat` is built from
// 汀's own shipped packs and covers the screens that run before any backend has
// been reached; `boot.catalog` is built from what the DEPLOYMENT reports it can
// render and covers everything after. A single catalogue would have to be one
// or the other — either the setting screen is untranslatable, or the language
// list is hardcoded, and the second is the rule this whole module exists for.
function Root() {
  // ⚠️ Evidence of a configured install skips this screen: a session token in
  // storage (the shared cross-frontend contract from core's http.ts — a
  // same-origin demo hands the token out directly) or a dc_sid cookie (the
  // demo hub sets one on every response, so an opened page already IS a
  // session). Sending either person to "which backend?" strands a working
  // install on the setting screen; boot instead and let a bad credential fail
  // visibly, where "edit address" stays one tap away.
  const [phase, setPhase] = useState<'setting' | 'booting' | 'up' | 'failed'>(() => {
    if (!isFirstRun()) return 'booting';
    try {
      if (localStorage.getItem('daycore.sessionToken')) return 'booting';
      if (/(?:^|;\s*)dc_sid=/.test(document.cookie)) return 'booting';
    } catch {
      /* storage unreadable — asking is the safe fallback */
    }
    return 'setting';
  });
  const [boot, setBoot] = useState<Boot | null>(null);
  const [bootCat, setBootCat] = useState<Catalog | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    void bootstrapCatalog(SHIPPED).then(setBootCat);
  }, []);

  useEffect(() => {
    if (phase !== 'booting') return;
    let live = true;
    bootUp(manifest).then(
      (b) => {
        if (!live) return;
        setBoot(b);
        setPhase('up');
        // The theme the session is on — through the whitelist, so a backend
        // default from another family ('sky') can never strand data-tg on a
        // value no selector matches (that was the white-screen first paint).
        // The builtin base is applied immediately; custom-theme variables
        // follow once the family's list answers.
        applyTheme(api.themeForFamily(b.session, FAMILY_ID) || 'night', []);
        void api.themes().then(
          (th) => applyTheme(api.themeForFamily(b.session, FAMILY_ID) || 'night', th.themes ?? []),
          () => {
            /* the builtin base is already on; a failed list changes nothing */
          },
        );
        if (b.deferred.length) {
          // Not an error and not silent. An operator has to approve 汀's shadow
          // kind before that one token can be themed; until then the
          // stylesheet's own value applies and everything else works.
          console.info('waiting on operator approval before these can be themed:', b.deferred.join(', '));
        }
      },
      (e) => {
        if (!live) return;
        const t = bootCat?.t ?? ((k: string) => k);
        setErr(
          api.isUnreachable(e)
            ? t('boot.unreachable')
            : e && typeof e === 'object' && 'kind' in e && (e as { kind: string }).kind === 'too-old'
              ? t('boot.tooOld', { version: String((e as { message: string }).message) })
              : e instanceof Error
                ? e.message
                : String(e),
        );
        setPhase('failed');
      },
    );
    return () => {
      live = false;
    };
  }, [phase, bootCat]);

  // Nothing renders before the bootstrap pack lands. It is a same-origin fetch
  // of a small file, and a flash of untranslated keys is worse than a beat of
  // nothing.
  if (!bootCat) return <div className="tg-app" />;
  const t = bootCat.t;

  if (phase === 'setting') {
    return (
      <Setting
        cat={bootCat}
        onDone={() => setPhase('booting')}
        onLocale={() => void bootstrapCatalog(SHIPPED).then(setBootCat)}
      />
    );
  }
  if (phase === 'up' && boot) return <App boot={boot} />;
  if (phase === 'failed') {
    return (
      <div className="tg-app">
        <div className="tg-frame">
          <div className="tg-main">
            <h1 className="tg-title md">{t('boot.failed.title')}</h1>
            <p className="tg-sub">{err}</p>
            <div className="tg-actrow">
              <button className="tg-btn pri" onClick={() => setPhase('setting')}>
                {t('boot.failed.editAddress')}
              </button>
              <button className="tg-btn sec" onClick={() => setPhase('booting')}>
                {t('boot.failed.retry')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="tg-app">
      <div className="tg-frame">
        <div className="tg-main">
          <p className="tg-sub">{t('boot.connecting')}</p>
        </div>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
