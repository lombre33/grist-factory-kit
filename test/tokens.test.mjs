// Les jetons de la charte (css/tokens.css) et les feuilles qui les emploient (css/windows.css) : contraste de 4,5:1 au moins en clair et en sombre, les deux blocs sombres identiques,
// aucune couleur ni aucun z-index en dur hors des jetons. L'apparence réelle (le thème choisi, le thème de Grist, celui du système) est aux essais du navigateur.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { tokensCss, windowsCss, light, darkChosen, darkSystem, hexOnly, ratio } from './jetons.mjs';

// [texte, fond] : ce que windows.css pose l'un sur l'autre, puis ce que la charte permet aux apps de poser (l'en-tête de tokens.css en donne la règle).
const PAIRS = [
  ['--text', '--surface'], ['--text', '--surface-sunken'], ['--text', '--bg'], ['--text', '--accent-soft'],
  ['--text-muted', '--surface'], ['--text-muted', '--surface-sunken'], ['--text-muted', '--bg'], ['--text-muted', '--accent-soft'], ['--text-muted', '--good-soft'], ['--text-muted', '--danger-soft'],
  ['--on-accent', '--accent-solid'], ['--on-accent', '--accent-solid-hover'],
  ['--accent-ink', '--surface'], ['--accent-ink', '--surface-sunken'], ['--accent-ink', '--bg'], ['--accent-ink', '--accent-soft'],
  ['--danger-ink', '--surface'], ['--danger-ink', '--bg'], ['--danger-ink', '--danger-soft'],
  ['--good', '--surface'], ['--good', '--good-soft'],
];

for (const [name, set] of [['clair', hexOnly(light)], ['sombre (choix de la personne ou de Grist)', { ...hexOnly(light), ...hexOnly(darkChosen) }], ['sombre (système)', { ...hexOnly(light), ...hexOnly(darkSystem) }]]) {
  test(`contraste de 4,5:1 au moins en ${name}`, () => {
    const failures = [];
    for (const [text, background] of PAIRS) {
      assert.ok(set[text] && set[background], `jeton absent : ${text} ou ${background}`);
      const value = ratio(set[text], set[background]);
      if (value < 4.5) failures.push(`${text} sur ${background} : ${value.toFixed(2)}:1`);
    }
    assert.deepEqual(failures, []);
  });
}

test('les règles de l\'en-tête tiennent : --danger et --accent ne portent pas de texte seuls, --accent-solid porte le blanc', () => {
  // --danger sur blanc et --accent sous du blanc en sombre sont sous 4,5:1 : c'est pour cela que la charte a --danger-ink et --accent-solid.
  assert.ok(ratio(light['--danger'], light['--surface']) < 4.5);
  assert.ok(ratio({ ...light, ...darkChosen }['--accent'], '#ffffff') < 4.5);
  assert.ok(ratio(darkChosen['--accent-solid'] || light['--accent-solid'], light['--on-accent']) >= 4.5);
});

test('le thème sombre choisi (ou posé par Grist) et celui du système disent la même chose', () => {
  assert.deepEqual(darkSystem, darkChosen);
});

test('le sombre ne redéfinit que des jetons du clair, et laisse en place ce qui ne change pas de thème', () => {
  for (const key of Object.keys(darkChosen)) assert.ok(key in light, `${key} n'existe pas en clair`);
  for (const key of ['--accent-solid', '--accent-solid-hover', '--on-accent', '--radius-sm', '--font-ui', '--z-window', '--z-dialog']) {
    assert.ok(key in light, key);
    assert.ok(!(key in darkChosen), `${key} ne change pas en sombre`);
  }
});

test('les couches sont rangées, un niveau de 100 chacune', () => {
  const z = name => Number(light[name]);
  const order = ['--z-floating-toolbar', '--z-menu', '--z-tip', '--z-window', '--z-dialog'].map(z);
  assert.ok(order.every(Number.isInteger));
  for (let i = 1; i < order.length; i++) assert.ok(order[i] - order[i - 1] >= 100, `niveaux ${i - 1} et ${i} trop proches`);
});

test('la police est celle du système, jamais une police d\'un autre site', () => {
  assert.match(light['--font-ui'], /^system-ui,/);
  assert.doesNotMatch(tokensCss + windowsCss, /@font-face|@import|url\(|fonts\.googleapis/);
});

test('les feuilles du kit ne posent aucune couleur ni aucun z-index en dur (les valeurs sont dans les jetons)', () => {
  const withoutTokens = windowsCss.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(withoutTokens, /#[0-9a-fA-F]{3,8}\b/, 'couleur hexadécimale en dur');
  assert.doesNotMatch(withoutTokens, /\brgba?\(|\bhsla?\(/, 'couleur fonctionnelle en dur');
  for (const [, value] of withoutTokens.matchAll(/z-index:\s*([^;}]+)/g)) assert.match(value.trim(), /^var\(--z-/, `z-index en dur : ${value}`);
});

test('windows.css n\'emploie que des jetons définis (par tokens.css ou par lui-même) ; ses deux écarts réglables ont une valeur de repli', () => {
  const defined = new Set([...Object.keys(light), ...Object.keys(darkChosen)]);
  const own = new Set([...windowsCss.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m => m[1]));
  for (const [, name] of windowsCss.matchAll(/var\((--[a-z0-9-]+)\)/g)) {
    assert.ok(defined.has(name) || own.has(name), `${name} n'est défini nulle part`);
  }
  for (const gap of ['--pp-modal-title-gap', '--pp-modal-actions-gap']) assert.match(windowsCss, new RegExp(`var\\(${gap},\\s*\\d+px\\)`), `${gap} sans valeur de repli`);
});
