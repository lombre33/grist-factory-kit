// Le noyau de la mise à jour des noms (js/names-update/plan.js) : ce que Sync+ garde, ce que le lot change, ce qui le bloquerait, et la preuve qu'il est passé.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { syncTables, keepOut, summarize, touched, check, applied, SYNC_KEY } from '../js/names-update/plan.js';

const BATCH = [
  ['RenameTable', 'Publipostage_Modeles', 'Publipostage_Templates'],
  ['RenameColumn', 'Publipostage_Templates', 'Nom', 'Name'],
  ['ModifyColumn', 'Publipostage_Templates', 'Name', { label: 'Name' }],
  ['RenameTable', 'Publipostage_PreferencesModeles', 'Publipostage_TemplatePreferences'],
  ['RenameColumn', 'Publipostage_TemplatePreferences', 'Utilisateur', 'User'],
];
const SCHEMA = { tables: { Publipostage_Modeles: ['Nom', 'Jeton'], Publipostage_PreferencesModeles: ['Utilisateur', 'ModeleId'], Clients: ['Nom'] } };

test('Sync+ : la colonne id_sync désigne une table qu\'il envoie ou qu\'il reçoit, quelle que soit la casse', () => {
  assert.equal(SYNC_KEY, 'id_sync');
  const used = syncTables({ tables: { A: ['Nom', 'id_sync'], B: ['Nom'], C: ['ID_SYNC'] } });
  assert.deepEqual([...used].sort(), ['a', 'c']);
});

test('Sync+ : les tables que l\'app dit partagées s\'ajoutent (lues dans `Synchro` par un propriétaire)', () => {
  assert.deepEqual([...syncTables({ tables: { A: ['Nom'] }, shared: ['A', 'Z'] })].sort(), ['a', 'z']);
  assert.equal(syncTables(null).size, 0);
  assert.equal(syncTables({}).size, 0);
});

test('une table de Sync+ garde son nom et ses colonnes : son renommage, celui de ses colonnes et ses libellés sont retirés du lot', () => {
  const { actions, held } = keepOut(BATCH, new Set(['publipostage_modeles']));
  assert.deepEqual(actions, BATCH.slice(3));
  assert.deepEqual(held, ['Publipostage_Modeles']);
});

test('une table de Sync+ déjà aux noms anglais garde ses colonnes : seules ses actions de colonne sont retirées', () => {
  const english = [['RenameColumn', 'Publipostage_Templates', 'Nom', 'Name'], ['RenameColumn', 'Clients', 'A', 'B']];
  const { actions, held } = keepOut(english, new Set(['publipostage_templates']));
  assert.deepEqual(actions, [english[1]]);
  assert.deepEqual(held, ['Publipostage_Templates']);
});

test('rien à garder : le lot passe tel quel ; tout garder : le lot est vide', () => {
  assert.deepEqual(keepOut(BATCH, new Set()), { actions: BATCH, held: [] });
  const all = keepOut(BATCH, new Set(['publipostage_modeles', 'publipostage_preferencesmodeles']));
  assert.deepEqual(all, { actions: [], held: ['Publipostage_Modeles', 'Publipostage_PreferencesModeles'] });
});

test('une table de Sync+ qui est aussi l\'arrivée d\'un renommage retire ce renommage (le nom serait pris)', () => {
  const { actions, held } = keepOut(BATCH, new Set(['publipostage_templates']));
  assert.deepEqual(actions, BATCH.slice(3));
  assert.deepEqual(held, ['Publipostage_Templates']);
});

test('le bilan : paires de tables, colonnes renommées, libellés changés', () => {
  assert.deepEqual(summarize(BATCH), { tables: [['Publipostage_Modeles', 'Publipostage_Templates'], ['Publipostage_PreferencesModeles', 'Publipostage_TemplatePreferences']], columns: 2, labels: 1 });
  assert.deepEqual(summarize([]), { tables: [], columns: 0, labels: 0 });
});

test('les tables touchées : avant et après, sans doublon, et une table dont seules les colonnes changent y est aussi', () => {
  assert.deepEqual(touched(BATCH), [{ before: 'Publipostage_Modeles', after: 'Publipostage_Templates' }, { before: 'Publipostage_PreferencesModeles', after: 'Publipostage_TemplatePreferences' }]);
  assert.deepEqual(touched([['RenameColumn', 'Clients', 'A', 'B'], ['ModifyColumn', 'Clients', 'B', { label: 'B' }]]), [{ before: 'Clients', after: 'Clients' }]);
});

test('le lot se rejoue sur le schéma : il passe quand les sources existent et que les arrivées sont libres', () => {
  assert.deepEqual(check(BATCH, SCHEMA), { ok: true, taken: [], missing: [] });
});

test('un nom d\'arrivée déjà pris est signalé (Grist ne refuserait pas : il écrirait « 2 »)', () => {
  const both = { tables: { ...SCHEMA.tables, Publipostage_Templates: ['Name'] } };
  assert.deepEqual(check(BATCH, both), { ok: false, taken: ['Publipostage_Templates'], missing: ['Publipostage_Templates.Nom'] });
  const column = { tables: { Publipostage_Modeles: ['Nom', 'Name'] } };
  assert.deepEqual(check(BATCH.slice(0, 2), column).taken, ['Publipostage_Templates.Name']);
});

test('une source absente est signalée, pour une table comme pour une colonne', () => {
  assert.deepEqual(check([['RenameTable', 'Absente', 'X']], SCHEMA).missing, ['Absente']);
  assert.deepEqual(check([['RenameColumn', 'Clients', 'Rien', 'X']], SCHEMA).missing, ['Clients.Rien']);
  assert.deepEqual(check([['ModifyColumn', 'Clients', 'Rien', { label: 'X' }]], SCHEMA).missing, ['Clients.Rien']);
});

test('les capitales ne comptent pas, comme dans Grist', () => {
  const schema = { tables: { clients: ['nom'] } };
  assert.equal(check([['RenameColumn', 'Clients', 'NOM', 'Name']], schema).ok, true);
  assert.equal(check([['RenameTable', 'CLIENTS', 'Accounts']], schema).ok, true);
});

test('le lot est reconnu appliqué seulement quand tout y est : arrivées présentes, départs absents', () => {
  assert.equal(applied(BATCH, SCHEMA, SCHEMA), false);
  const done = { tables: { Publipostage_Templates: ['Name', 'Jeton'], Publipostage_TemplatePreferences: ['User', 'ModeleId'], Clients: ['Nom'] } };
  assert.equal(applied(BATCH, done, SCHEMA), true);
  const half = { tables: { Publipostage_Templates: ['Name', 'Jeton'], Publipostage_PreferencesModeles: ['Utilisateur', 'ModeleId'], Clients: ['Nom'] } };
  assert.equal(applied(BATCH, half, SCHEMA), false);
  const both = { tables: { ...done.tables, Publipostage_Modeles: ['Nom'] } };
  assert.equal(applied(BATCH, both, SCHEMA), false);
});

test('un nom d\'arrivée pris par un autre entre-temps : Grist écrit « 2 », le lot n\'est PAS reconnu appliqué même si le nom d\'arrivée est là', () => {
  const before = { tables: { Prefs: ['Utilisateur'] } };
  const batch = [['RenameTable', 'Prefs', 'Preferences']];
  assert.equal(applied(batch, { tables: { Preferences: ['A'], Preferences2: ['Utilisateur'] } }, before), false);
  assert.equal(applied(batch, { tables: { Preferences: ['Utilisateur'] } }, before), true);
  assert.equal(applied(batch, { tables: { Preferences: ['Utilisateur'], Preferences2: ['A'] } }, { tables: { Prefs: ['Utilisateur'], Preferences2: ['A'] } }), true, 'une table « 2 » qui existait déjà n\'est pas de Grist');
  const columns = [['RenameColumn', 'T', 'Nom', 'Name']];
  assert.equal(applied(columns, { tables: { T: ['Name', 'Name2'] } }, { tables: { T: ['Nom', 'Name'] } }), false);
  assert.equal(applied(columns, { tables: { T: ['Name'] } }, { tables: { T: ['Nom'] } }), true);
});
