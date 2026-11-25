// Les textes de la fenêtre de mise à jour des noms (js/names-update/strings.js) : le français et l'anglais côte à côte, tous employés, vouvoiement, et les pluriels qui se lisent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createI18n } from '../js/i18n.js';
import { NAMES_STRINGS } from '../js/names-update/strings.js';

const windowSource = readFileSync(new URL('../js/names-update/window.js', import.meta.url), 'utf8');
// Les clés dites par `t('clé'` et celles que `describe` et la fenêtre passent en `label: 'clé'` ou `skip: 'clé'` (le bouton les traduit ensuite).
const used = new Set([...windowSource.matchAll(/\bt\('([A-Za-z]+)'|\b(?:label|skip): '([A-Za-z]+)'/g)].map(match => `kit.names.${match[1] || match[2]}`));
const french = createI18n({ strings: NAMES_STRINGS, language: 'fr' });
const english = createI18n({ strings: NAMES_STRINGS, language: 'en' });

test('chaque texte existe en français et en anglais, et la fenêtre n\'en emploie aucun qui manque ni n\'en laisse un sans emploi', () => {
  for (const [key, entry] of Object.entries(NAMES_STRINGS)) {
    assert.ok(entry.fr && entry.en, `${key} : une langue manque`);
    assert.match(key, /^kit\.names\.[A-Za-z]+$/);
    assert.ok(used.has(key), `${key} n'est employé nulle part`);
  }
  for (const key of used) assert.ok(key in NAMES_STRINGS, `${key} n'existe pas`);
});

test('vouvoiement dans les textes français (« vous », « votre » ; jamais « tu », « ton », « t\' »), et « modèle » plutôt que « template »', () => {
  for (const [key, entry] of Object.entries(NAMES_STRINGS)) {
    assert.doesNotMatch(entry.fr, /(^|[^\p{L}])(tu|ton|ta|tes|toi|t['’])($|[^\p{L}])/iu, key);
    assert.doesNotMatch(entry.fr, /template/i, key);
  }
});

test('les pluriels : tables, colonnes, lignes, tables gardées (0 et 1 au singulier en français, seul 1 en anglais)', () => {
  assert.equal(french.t('kit.names.list', { tables: 1, columns: 0 }), 'Voir les noms qui changent (1 table, 0 colonne)');
  assert.equal(french.t('kit.names.list', { tables: 7, columns: 3 }), 'Voir les noms qui changent (7 tables, 3 colonnes)');
  assert.equal(english.t('kit.names.list', { tables: 1, columns: 1 }), 'See the names that change (1 table, 1 column)');
  assert.equal(english.t('kit.names.list', { tables: 0, columns: 2 }), 'See the names that change (0 tables, 2 columns)');
  assert.equal(french.t('kit.names.done', { tables: 5, rows: 19 }), 'Terminé : 5 tables mises à jour, 19 lignes vérifiées avant et après, aucune modifiée.');
  assert.equal(french.t('kit.names.done', { tables: 1, rows: 1 }), 'Terminé : 1 table mise à jour, 1 ligne vérifiée avant et après, aucune modifiée.');
  assert.equal(english.t('kit.names.done', { tables: 1, rows: 1 }), 'Done: 1 table updated, 1 row checked before and after, none changed.');
  assert.equal(french.t('kit.names.held', { n: 1, names: 'Publipostage_Modeles' }), 'Une table garde son ancien nom (un partage Sync+ s’en sert) : Publipostage_Modeles. Elle sera renommée quand ce partage sera retiré.');
  assert.equal(french.t('kit.names.held', { n: 2, names: 'A, B' }), '2 tables gardent leurs anciens noms (un partage Sync+ s’en sert) : A, B. Elles seront renommées quand ce partage sera retiré.');
  assert.equal(english.t('kit.names.held', { n: 2, names: 'A, B' }), '2 tables keep their old names (a Sync+ share uses them): A, B. They will be renamed once that share is removed.');
  assert.equal(english.t('kit.names.held', { n: 1, names: 'A' }), 'One table keeps its old name (a Sync+ share uses it): A. It will be renamed once that share is removed.');
  assert.equal(french.t('kit.names.more', { n: 2 }), '… et 2 autres');
});

test('le nom de l\'app et les détails se glissent dans le texte tels quels (jamais relus comme un pluriel)', () => {
  assert.match(french.t('kit.names.intro', { app: 'Publipostage+' }), /^Publipostage\+ range désormais/);
  assert.equal(french.t('kit.names.detail', { detail: '{n|a|b} Table not found' }), 'Détail : {n|a|b} Table not found');
});
