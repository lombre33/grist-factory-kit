// L'enchaînement de la mise à jour des noms (js/names-update/run.js) contre un document qui se comporte comme le vrai Grist (test/names-update-fake.mjs) : qui peut la faire, ce qui
// est envoyé (un seul lot), et chaque panne possible, avec ce que la personne devra entendre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepare, execute } from '../js/names-update/run.js';
import { fakeDoc } from './names-update-fake.mjs';

// Le lot de l'app : ses tables d'avant vers les noms anglais, d'après les noms du document maintenant (le lot est recalculé à chaque appel, comme le fait l'app).
function plan(schema) {
  const names = Object.keys(schema.tables);
  const actions = [];
  if (names.includes('Publipostage_Modeles')) actions.push(['RenameTable', 'Publipostage_Modeles', 'Publipostage_Templates'], ['RenameColumn', 'Publipostage_Templates', 'Nom', 'Name']);
  if (names.includes('Publipostage_PreferencesModeles')) actions.push(['RenameTable', 'Publipostage_PreferencesModeles', 'Publipostage_TemplatePreferences']);
  return actions.length ? actions : null;
}
const legacy = options => fakeDoc({
  Publipostage_Modeles: { columns: ['Nom', 'Jeton'], rows: 5 },
  Publipostage_PreferencesModeles: { columns: ['Utilisateur'], rows: 2 },
  Clients: { columns: ['Nom'], rows: 40 },
}, options);

test('un document aux noms d\'avant, un propriétaire : prêt, et rien n\'est écrit pour l\'instant', async () => {
  const doc = legacy();
  const prepared = await prepare({ port: doc.port, plan });
  assert.equal(prepared.state, 'ready');
  assert.deepEqual(prepared.summary.tables, [['Publipostage_Modeles', 'Publipostage_Templates'], ['Publipostage_PreferencesModeles', 'Publipostage_TemplatePreferences']]);
  assert.equal(doc.applied.length, 0);
});

test('un document déjà aux noms anglais : rien à faire, et on ne demande même pas qui est propriétaire', async () => {
  const doc = fakeDoc({ Publipostage_Templates: { columns: ['Name'], rows: 1 } });
  assert.equal((await prepare({ port: doc.port, plan })).state, 'none');
  assert.equal(doc.ownerChecks, 0);
});

test('qui n\'est pas propriétaire (ou ne peut pas le prouver, ou ne peut pas écrire) ne voit rien : l\'app continue sur les anciens noms', async () => {
  for (const options of [{ owner: false }, { owner: null }, { readOnly: true }]) {
    const doc = legacy(options);
    const prepared = await prepare({ port: doc.port, plan });
    assert.equal(prepared.state, 'wait', JSON.stringify(options));
    assert.equal(prepared.reason, 'rights');
    assert.equal(doc.applied.length, 0);
  }
});

test('un schéma illisible, ou un propriétaire qu\'on ne sait pas prouver (la preuve échoue), est une attente silencieuse', async () => {
  const unreadable = legacy();
  unreadable.port.readSchema = async () => { throw new Error('offline'); };
  assert.equal((await prepare({ port: unreadable.port, plan })).state, 'wait');
  const unproven = legacy();
  unproven.port.isOwner = async () => { throw new Error('REST 500'); };
  assert.equal((await prepare({ port: unproven.port, plan })).state, 'wait');
});

test('les deux jeux de noms dans le document : pas de fenêtre, l\'app dit ce qui bloque (le renommage s\'ajouterait « 2 »)', async () => {
  const doc = legacy();
  doc.add('Publipostage_Templates', ['Name'], 3);
  const prepared = await prepare({ port: doc.port, plan });
  assert.equal(prepared.state, 'blocked');
  assert.deepEqual(prepared.taken, ['Publipostage_Templates']);
});

test('la mise à jour : un seul lot, tout est renommé, les lignes comptées avant et après sont les mêmes', async () => {
  const doc = legacy();
  const result = await execute({ port: doc.port, plan });
  assert.equal(doc.applied.length, 1);
  assert.deepEqual(result, { state: 'done', tables: 2, columns: 1, rows: 7, mismatch: [] });
  assert.deepEqual(doc.tables(), { Publipostage_Templates: ['Name', 'Jeton'], Publipostage_TemplatePreferences: ['Utilisateur'], Clients: ['Nom'] });
  assert.equal(doc.rows('Publipostage_Templates'), 5);
  assert.equal(doc.rows('Clients'), 40);
});

test('sans comptage de lignes (facultatif), la mise à jour se fait quand même et ne dit pas « lignes vérifiées »', async () => {
  const doc = legacy();
  delete doc.port.rowCount;
  const result = await execute({ port: doc.port, plan });
  assert.equal(result.state, 'done');
  assert.equal(result.rows, null);
});

test('une table que Sync+ utilise (colonne id_sync) garde son nom et ses colonnes ; le reste est renommé', async () => {
  const doc = legacy();
  doc.add('Publipostage_Modeles', ['Nom', 'Jeton', 'id_sync', 'MajLe'], 5);
  const prepared = await prepare({ port: doc.port, plan });
  assert.equal(prepared.state, 'ready');
  assert.deepEqual(prepared.held, ['Publipostage_Modeles']);
  const result = await execute({ port: doc.port, plan });
  assert.equal(result.state, 'done');
  assert.deepEqual(doc.tables(), { Publipostage_Modeles: ['Nom', 'Jeton', 'id_sync', 'MajLe'], Publipostage_TemplatePreferences: ['Utilisateur'], Clients: ['Nom'] });
  assert.deepEqual(doc.applied[0], [['RenameTable', 'Publipostage_PreferencesModeles', 'Publipostage_TemplatePreferences']]);
});

test('si Sync+ utilise tout ce que l\'app voulait renommer : rien à faire, et aucune écriture', async () => {
  const doc = fakeDoc({ Publipostage_Modeles: { columns: ['Nom', 'id_sync'], rows: 5 } });
  const prepared = await prepare({ port: doc.port, plan });
  assert.equal(prepared.state, 'none');
  assert.deepEqual(prepared.held, ['Publipostage_Modeles']);
  assert.equal((await execute({ port: doc.port, plan })).state, 'already');
  assert.equal(doc.applied.length, 0);
});

test('deux widgets valident l\'un après l\'autre : le second voit « déjà fait » et n\'envoie rien', async () => {
  const doc = legacy();
  assert.equal((await execute({ port: doc.port, plan })).state, 'done');
  assert.equal((await execute({ port: doc.port, plan })).state, 'already');
  assert.equal(doc.applied.length, 1);
});

test('un nom d\'arrivée apparu entre la fenêtre et le clic : rien n\'est envoyé (Grist l\'aurait renommé en « 2 »)', async () => {
  const doc = legacy();
  assert.equal((await prepare({ port: doc.port, plan })).state, 'ready');
  doc.add('Publipostage_Templates', ['Name'], 1);
  const result = await execute({ port: doc.port, plan });
  assert.equal(result.state, 'blocked');
  assert.equal(doc.applied.length, 0);
  assert.ok(doc.tables().Publipostage_Modeles);
});

test('le lot est refusé (droits, règle d\'accès) : « refusé », rien n\'a changé, le détail est gardé', async () => {
  const doc = legacy();
  doc.next = { refuse: 'Blocked by table structure access rules' };
  const result = await execute({ port: doc.port, plan });
  assert.equal(result.state, 'refused');
  assert.match(result.detail, /access rules/);
  assert.ok(doc.tables().Publipostage_Modeles);
  assert.equal((await execute({ port: doc.port, plan })).state, 'done', 'réessayer passe quand la cause a disparu');
});

test('la réponse se perd alors que le lot est passé : les noms relus disent « fait »', async () => {
  const doc = legacy();
  doc.next = { lose: true };
  const result = await execute({ port: doc.port, plan });
  assert.equal(result.state, 'done');
  assert.ok(doc.tables().Publipostage_Templates);
});

test('pas de réponse dans le délai : « inconnu » (le lot peut encore passer), puis réessayer relit les noms', async () => {
  const doc = legacy();
  doc.next = { hang: true };
  const result = await execute({ port: doc.port, plan, timeoutMs: 20 });
  assert.equal(result.state, 'unknown');
  assert.equal(result.timedOut, true);
  assert.equal((await execute({ port: doc.port, plan })).state, 'done');
});

test('un nom pris pendant l\'envoi, sur un lot sans colonne : Grist ajoute « 2 » et répond 200 ; les noms relus ne sont pas ceux attendus : « inconnu », jamais « terminé »', async () => {
  const doc = fakeDoc({ Publipostage_PreferencesModeles: { columns: ['Utilisateur'], rows: 2 } });
  doc.next = { race: ['Publipostage_TemplatePreferences'] };
  const result = await execute({ port: doc.port, plan });
  assert.equal(result.state, 'unknown');
  assert.ok(doc.tables().Publipostage_TemplatePreferences2);
});

test('un nom pris pendant l\'envoi, sur un lot avec colonnes : Grist refuse tout (colonne introuvable), rien ne change : « inconnu » aussi, les anciens noms restent', async () => {
  const doc = legacy();
  doc.next = { race: ['Publipostage_Templates'] };
  const result = await execute({ port: doc.port, plan });
  assert.equal(result.state, 'unknown');
  assert.ok(doc.tables().Publipostage_Modeles);
});

test('une ligne qui manquerait après (ce qui ne doit jamais arriver) est signalée avec le nom de la table', async () => {
  const doc = legacy();
  doc.next = { loseRows: 'Publipostage_Templates' };
  const result = await execute({ port: doc.port, plan });
  assert.equal(result.state, 'done');
  assert.deepEqual(result.mismatch, ['Publipostage_Templates']);
});

test('le schéma illisible au moment de la mise à jour : « inconnu », rien n\'est envoyé', async () => {
  const doc = legacy();
  doc.port.readSchema = async () => { throw new Error('offline'); };
  const result = await execute({ port: doc.port, plan });
  assert.equal(result.state, 'unknown');
  assert.equal(doc.applied.length, 0);
});
