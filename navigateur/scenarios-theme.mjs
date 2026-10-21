// Les essais du thème et de la langue, dans un vrai navigateur : d'où vient le thème affiché, ce que Theme garde, ce qui reste debout quand le navigateur refuse son stockage, d'où vient la
// langue et ce que la page en fait, et ce que dit le kit quand un module est chargé deux fois.
import { check, click, openPage } from './aide.mjs';
import { light, dark, cssRgb } from '../test/jetons.mjs';

const backgroundOf = page => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const attributeOf = (page, name) => page.evaluate(attribute => document.documentElement.getAttribute(attribute), name);
const stored = (page, key) => page.evaluate(name => localStorage.getItem(name), key);

// Les trois sources du thème, dans l'ordre : le choix de la personne (data-theme), puis le thème de Grist (data-grist-appearance, que son script d'API pose sur <html>), puis la
// préférence du système. Les feuilles et Theme.isDark() doivent dire la même chose dans les 18 cas.
export async function themeSources(env) {
  for (const system of ['light', 'dark']) {
    const { page } = await openPage(env, { colorScheme: system });
    const wrong = [];
    for (const chosen of [null, 'light', 'dark']) {
      for (const grist of [null, 'light', 'dark']) {
        await page.evaluate(([theme, appearance]) => {
          const root = document.documentElement;
          if (theme) root.setAttribute('data-theme', theme); else root.removeAttribute('data-theme');
          if (appearance) root.setAttribute('data-grist-appearance', appearance); else root.removeAttribute('data-grist-appearance');
        }, [chosen, grist]);
        const expectedDark = chosen ? chosen === 'dark' : (grist ? grist === 'dark' : system === 'dark');
        const seen = { background: await backgroundOf(page), isDark: await page.evaluate(() => window.kit.Theme.isDark()) };
        if (seen.background !== cssRgb((expectedDark ? dark : light)['--bg']) || seen.isDark !== expectedDark) wrong.push({ system, chosen, grist, expectedDark, seen });
      }
    }
    check(`thème : choix de la personne > thème de Grist > système, feuilles et isDark() d'accord (système ${system}, 9 cas)`, wrong.length === 0, wrong);
    await page.context().close();
  }
}

// Ce que Theme garde et rend : le bouton à la vraie souris, le choix qui survit au rechargement, « système » qui retire la clé, une valeur inconnue sans effet, onChange.
export async function themeKept(env) {
  const { page } = await openPage(env, { colorScheme: 'light' });
  check('thème : sans choix gardé, le choix est « système » et rien n\'est posé sur <html>', (await page.evaluate(() => window.kit.Theme.choice)) === 'system' && (await attributeOf(page, 'data-theme')) === null);
  await click(page, '#theme-toggle');
  check('thème : le bouton bascule en sombre, pose data-theme="dark" et garde le choix', (await attributeOf(page, 'data-theme')) === 'dark' && (await stored(page, 'kit_theme')) === 'dark' && (await backgroundOf(page)) === cssRgb(dark['--bg']));
  await page.reload();
  await page.waitForFunction(() => window.kit);
  check('thème : le choix gardé revient au rechargement, avant que la personne ne touche à rien', (await page.evaluate(() => window.kit.Theme.choice)) === 'dark' && (await backgroundOf(page)) === cssRgb(dark['--bg']));
  await click(page, '#theme-toggle');
  check('thème : le deuxième clic revient en clair', (await attributeOf(page, 'data-theme')) === 'light' && (await backgroundOf(page)) === cssRgb(light['--bg']));
  const system = await page.evaluate(() => {
    const heard = [];
    const stop = window.kit.Theme.onChange(event => heard.push(event));
    const ignored = window.kit.Theme.set('rose');
    const kept = window.kit.Theme.set('system');
    stop();
    window.kit.Theme.set('dark');
    return { ignored, kept, heard, key: localStorage.getItem('kit_theme') };
  });
  check('thème : une valeur inconnue est sans effet', system.ignored === false && system.heard.length === 1);
  check('thème : « système » est gardé en retirant la clé, et onChange reçoit le choix et le thème affiché', system.kept === true && system.heard[0].choice === 'system' && system.heard[0].dark === false);
  check('thème : onChange cesse d\'écouter une fois retiré', system.heard.length === 1 && system.key === 'dark');
  await page.context().close();
}

// Le navigateur refuse son stockage (cadre isolé, navigation privée) : rien ne s'arrête, le choix vaut pour la page et Theme.set / I18n.store disent qu'il ne durera pas.
export async function storageRefused(env) {
  const refuse = () => Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('refusé', 'SecurityError'); } });
  const { page } = await openPage(env, { colorScheme: 'light', locale: 'en-US', init: refuse });
  check('stockage refusé : la page démarre, sans erreur, avec le thème du système et la langue du navigateur', (await page.evaluate(() => window.kit.Theme.choice)) === 'system' && (await page.evaluate(() => window.kit.I18n.language)) === 'en');
  await click(page, '#theme-toggle');
  check('stockage refusé : le bouton de thème marche pour la page', (await attributeOf(page, 'data-theme')) === 'dark' && (await backgroundOf(page)) === cssRgb(dark['--bg']));
  const answers = await page.evaluate(() => ({ theme: window.kit.Theme.set('light'), language: window.kit.I18n.store('fr') }));
  check('stockage refusé : Theme.set et I18n.store rendent false (le choix ne survivra pas), sans exception', answers.theme === false && answers.language === false);
  await page.context().close();
}

const titleOf = page => page.$eval('h1', el => el.textContent);
const languageOf = page => page.evaluate(() => ({ kit: window.kit.I18n.language, html: document.documentElement.lang }));

// D'où vient la langue : GFS quand il héberge l'app (gfs=<n> et language), sinon le choix gardé, sinon le navigateur.
export async function language(env) {
  const cases = [
    { label: 'navigateur en français', locale: 'fr-FR', expected: 'fr' },
    { label: 'navigateur en anglais', locale: 'en-US', expected: 'en' },
    { label: 'navigateur dans une autre langue : l\'anglais', locale: 'de-DE', expected: 'en' },
    { label: 'GFS donne l\'anglais à un navigateur français', locale: 'fr-FR', search: '?gfs=3&language=en', expected: 'en' },
    { label: 'language sans gfs=<n> est ignoré', locale: 'fr-FR', search: '?language=en', expected: 'fr' },
  ];
  for (const { label, locale, search, expected } of cases) {
    const { page } = await openPage(env, { locale, search });
    const seen = await languageOf(page);
    check(`langue : ${label} -> ${expected}, et <html lang> la suit`, seen.kit === expected && seen.html === expected, seen);
    await page.context().close();
  }

  const { page } = await openPage(env, { locale: 'fr-FR' });
  check('langue : le texte écrit à la main et ses attributs sont traduits (data-i18n, -title, -aria, -placeholder), en français', (await titleOf(page)) === 'Page d\'essai du kit'
    && (await page.$eval('p.muted', el => el.title)) === 'Aide de la page'
    && (await page.$eval('#field', el => `${el.placeholder}|${el.getAttribute('aria-label')}`)) === 'Un champ de la page|Champ de la page');
  await click(page, '#lang-toggle');
  check('langue : le bouton passe la page en anglais, tout de suite, et <html lang> avec', (await titleOf(page)) === 'Kit test page'
    && (await page.$eval('#field', el => el.placeholder)) === 'A page field' && (await languageOf(page)).html === 'en');
  await page.reload();
  await page.waitForFunction(() => window.kit);
  check('langue : le choix de la personne revient au rechargement', (await titleOf(page)) === 'Kit test page' && (await stored(page, 'kit_lang')) === 'en');
  await page.goto(`${env.origin}/navigateur/page.html?gfs=2&language=fr`);
  await page.waitForFunction(() => window.kit);
  check('langue : GFS passe avant le choix gardé', (await titleOf(page)) === 'Page d\'essai du kit' && (await stored(page, 'kit_lang')) === 'en');
  await page.context().close();
}

// Un module du kit chargé par deux adresses est signalé, au lieu de deux langues et de deux piles de fenêtres qui s'ignorent.
export async function loadedTwice(env) {
  const { page, warnings } = await openPage(env, { hash: '#double' });
  await page.waitForTimeout(500);
  const heard = warnings.filter(text => text.includes('chargé deux fois'));
  check('double chargement : charger i18n.js par deux adresses est signalé, une fois, et nomme le module', heard.length === 1 && heard[0].includes('i18n'), warnings);
  await page.context().close();
  const quiet = await openPage(env, {});
  check('chargement simple : aucun avertissement du kit', quiet.warnings.length === 0, quiet.warnings);
  await quiet.page.context().close();
}
