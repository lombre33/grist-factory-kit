// La traduction : d'où vient la langue, les pluriels, les variables, les textes manquants. Le moteur seul (sans page) ; la page, l'attribut `lang` et le stockage sont aux essais du
// navigateur (navigateur/essais.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createI18n, hostedLanguage, browserLanguage, resolveLanguage, I18n, KIT_STRINGS } from '../js/i18n.js';

// Les avertissements d'un appel, sans les laisser sortir dans le journal des essais.
function warningsOf(run) {
  const warnings = [];
  const original = console.warn;
  console.warn = message => warnings.push(message);
  try { run(); } finally { console.warn = original; }
  return warnings;
}

test('la langue de GFS ne compte qu\'avec gfs=<n> : seule, l\'app n\'est pas tenue de suivre celle de Grist', () => {
  assert.equal(hostedLanguage('?gfs=3&language=en'), 'en');
  assert.equal(hostedLanguage('?language=en&gfs=12'), 'en');
  assert.equal(hostedLanguage('?language=en'), null);
  assert.equal(hostedLanguage('?gfs=abc&language=en'), null);
  assert.equal(hostedLanguage('?gfs=&language=en'), null);
});

test('la langue de GFS est ignorée quand ce n\'est ni le français ni l\'anglais, et la casse ne compte pas', () => {
  assert.equal(hostedLanguage('?gfs=1&language=de'), null);
  assert.equal(hostedLanguage('?gfs=1&language='), null);
  assert.equal(hostedLanguage('?gfs=1'), null);
  assert.equal(hostedLanguage('?gfs=1&language=FR'), 'fr');
  assert.equal(hostedLanguage(''), null);
  assert.equal(hostedLanguage(undefined), null);
});

test('navigateur : la première langue parmi le français et l\'anglais ; l\'anglais s\'il n\'en propose aucune des deux ; le français s\'il ne dit rien', () => {
  assert.equal(browserLanguage(['fr-FR', 'en']), 'fr');
  assert.equal(browserLanguage(['de', 'en-US']), 'en');
  assert.equal(browserLanguage(['en-GB', 'fr']), 'en');
  assert.equal(browserLanguage(['de', 'es']), 'en');
  assert.equal(browserLanguage([]), 'fr');
  assert.equal(browserLanguage(undefined), 'fr');
  assert.equal(browserLanguage(['', null]), 'fr');
});

test('la langue au premier lancement : GFS, puis le choix de la personne, puis le navigateur', () => {
  assert.equal(resolveLanguage({ hosted: 'en', stored: 'fr', browser: ['fr'] }), 'en');
  assert.equal(resolveLanguage({ hosted: null, stored: 'en', browser: ['fr'] }), 'en');
  assert.equal(resolveLanguage({ hosted: null, stored: null, browser: ['en'] }), 'en');
  assert.equal(resolveLanguage({ hosted: 'de', stored: 'es', browser: ['fr'] }), 'fr');
  assert.equal(resolveLanguage(), 'fr');
});

test('pluriels : zéro et un sont au singulier en français, un seul l\'est en anglais', () => {
  const strings = { 'ex.q': { fr: '{n} {n|question|questions}', en: '{n} {n|question|questions}' } };
  const fr = createI18n({ strings, language: 'fr' });
  const en = createI18n({ strings, language: 'en' });
  assert.deepEqual([0, 1, 2, 5].map(n => fr.t('ex.q', { n })), ['0 question', '1 question', '2 questions', '5 questions']);
  assert.deepEqual([0, 1, 2, 5].map(n => en.t('ex.q', { n })), ['0 questions', '1 question', '2 questions', '5 questions']);
});

test('les règles de pluriel suivent la langue quand elle change (setLanguage, init)', () => {
  const i18n = createI18n({ strings: { 'ex.q': { fr: '{n} {n|question|questions}', en: '{n} {n|question|questions}' } }, language: 'fr' });
  assert.equal(i18n.t('ex.q', { n: 0 }), '0 question');
  i18n.setLanguage('en');
  assert.equal(i18n.t('ex.q', { n: 0 }), '0 questions');
  i18n.init({ hosted: 'fr', stored: null, browser: [] });
  assert.equal(i18n.t('ex.q', { n: 0 }), '0 question');
  i18n.init({ hosted: 'en', stored: null, browser: [] });
  assert.equal(i18n.t('ex.q', { n: 0 }), '0 questions');
});

test('une forme de pluriel peut porter une variable ou un autre pluriel', () => {
  const { t } = createI18n({ strings: {
    'ex.a': { fr: '{n|une ligne de {name}|{n} lignes de {name}}', en: '{n|one row of {name}|{n} rows of {name}}' },
    'ex.b': { fr: '{n|{m|un seul|{m} sur un}|{n} au total}', en: '{n|{m|only|{m} of one}|{n} in all}' },
  } });
  assert.equal(t('ex.a', { n: 1, name: 'Clients' }), 'une ligne de Clients');
  assert.equal(t('ex.a', { n: 4, name: 'Clients' }), '4 lignes de Clients');
  assert.equal(t('ex.b', { n: 1, m: 1 }), 'un seul');
  assert.equal(t('ex.b', { n: 1, m: 3 }), '3 sur un');
  assert.equal(t('ex.b', { n: 7, m: 1 }), '7 au total');
});

test('le texte d\'une variable n\'est jamais relu comme un pluriel ni comme une autre variable', () => {
  const { t } = createI18n({ strings: { 'ex.v': { fr: 'Colonne {name} : {n} {n|valeur|valeurs}', en: 'Column {name}: {n} {n|value|values}' } } });
  assert.equal(t('ex.v', { name: '{n|a|b}', n: 2 }), 'Colonne {n|a|b} : 2 valeurs');
  assert.equal(t('ex.v', { name: '{n}', n: 2 }), 'Colonne {n} : 2 valeurs');
});

test('une accolade qui n\'est pas un pluriel reste telle quelle', () => {
  const { t } = createI18n({ strings: { 'ex.c': { fr: 'Écrire {{nom}} dans le modèle ({x} inconnu, {n|reste ouvert)', en: 'Write {{nom}}' } } });
  assert.equal(t('ex.c', { n: 2 }), 'Écrire {{nom}} dans le modèle ({x} inconnu, {n|reste ouvert)');
});

test('texte inconnu : la clé est rendue et un seul avertissement est donné', () => {
  const { t } = createI18n();
  let result;
  const warnings = warningsOf(() => { result = t('absent.cle'); t('absent.cle'); });
  assert.equal(result, 'absent.cle');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /absent\.cle/);
});

test('traduction manquante : repli sur le français, avec un avertissement', () => {
  const { t } = createI18n({ strings: { 'ex.seul': { fr: 'Bonjour' } }, language: 'en' });
  let result;
  const warnings = warningsOf(() => { result = t('ex.seul'); });
  assert.equal(result, 'Bonjour');
  assert.equal(warnings.length, 1);
});

test('add : une clé redéfinie autrement est signalée, la même ne l\'est pas', () => {
  const i18n = createI18n({ strings: { 'ex.k': { fr: 'Un', en: 'One' } } });
  assert.deepEqual(warningsOf(() => i18n.add({ 'ex.k': { fr: 'Un', en: 'One' } })), []);
  assert.equal(warningsOf(() => i18n.add({ 'ex.k': { fr: 'Deux', en: 'Two' } })).length, 1);
  assert.equal(i18n.t('ex.k'), 'Deux');
});

test('setLanguage : sans effet sur une valeur inconnue ou la même ; les écouteurs ne sont avertis qu\'au changement', () => {
  const i18n = createI18n({ strings: { 'ex.k': { fr: 'Un', en: 'One' } } });
  const heard = [];
  const stop = i18n.onChange(language => heard.push(language));
  i18n.setLanguage('de');
  i18n.setLanguage('fr');
  assert.deepEqual(heard, []);
  i18n.setLanguage('en');
  assert.deepEqual(heard, ['en']);
  assert.equal(i18n.t('ex.k'), 'One');
  stop();
  i18n.setLanguage('fr');
  assert.deepEqual(heard, ['en']);
  assert.equal(i18n.language, 'fr');
});

test('init : les trois sources, chacune pouvant être donnée', () => {
  const i18n = createI18n();
  assert.equal(i18n.init({ hosted: 'en', stored: 'fr', browser: ['fr'] }), 'en');
  assert.equal(i18n.init({ hosted: null, stored: 'fr', browser: ['en'] }), 'fr');
  assert.equal(i18n.init({ hosted: null, stored: null, browser: ['de'] }), 'en');
  assert.equal(i18n.init({ hosted: null, stored: null, browser: [] }), 'fr');
});

test('store : faux sans clé de stockage ou sans stockage, jamais d\'exception', () => {
  const i18n = createI18n();
  i18n.init({ hosted: null, stored: null, browser: [] });
  assert.equal(i18n.store('en'), false);
  i18n.init({ storageKey: 'x_lang', hosted: null, stored: null, browser: [] });
  assert.equal(i18n.store('en'), false, 'pas de localStorage sous Node');
});

test('chaque texte du kit existe en français et en anglais, avec les mêmes variables, et le français dit « modèle », jamais « template »', () => {
  const variables = text => [...new Set([...text.matchAll(/\{(\w+)[|}]/g)].map(m => m[1]))].sort().join(',');
  assert.ok(Object.keys(KIT_STRINGS).length >= 3);
  for (const [key, entry] of Object.entries(KIT_STRINGS)) {
    assert.match(key, /^kit\./, 'les clés du kit commencent par « kit. »');
    assert.equal(typeof entry.fr, 'string', `${key} : français`);
    assert.equal(typeof entry.en, 'string', `${key} : anglais`);
    assert.equal(variables(entry.fr), variables(entry.en), `${key} : mêmes variables`);
    assert.doesNotMatch(entry.fr, /template/i, key);
  }
});

test('la langue de la page est celle des textes du kit', () => {
  assert.equal(I18n.t('kit.cancel'), 'Annuler');
  I18n.setLanguage('en');
  try { assert.equal(I18n.t('kit.cancel'), 'Cancel'); } finally { I18n.setLanguage('fr'); }
  assert.equal(I18n.t('kit.close'), 'Fermer');
});
