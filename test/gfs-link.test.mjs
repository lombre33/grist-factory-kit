// Le lien avec GFS (js/gfs-link.js) face à un GFS joué par l'essai : ce que l'app envoie, ce qu'elle garde, ce qu'elle ignore. Les formes sont celles des contrats de GFS (section 5).
// `createGfsLink({ host })` prend pour fenêtre de l'app un objet qui a sa `location`, son `parent`, son `addEventListener` et son `localStorage`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGfsLink, GfsLink } from '../js/gfs-link.js';

// Un GFS pour l'essai : il note ce que l'app poste et lui remet des messages venus du cadre parent, ou d'un autre cadre.
function gfs({ search = '?gfs=0&language=fr', localStorage = null } = {}) {
  const sent = [];
  const listeners = [];
  const parent = { postMessage: (message, origin) => sent.push({ message: structuredClone(message), origin }) };
  const host = { location: { search }, parent, localStorage, addEventListener: (type, fn) => { if (type === 'message') listeners.push(fn); } };
  const deliver = (data, source = parent) => listeners.forEach(fn => fn({ data, source }));
  const calls = name => sent.map(entry => entry.message).filter(message => message.type === 'appel' && message.nom === name);
  const replyTo = (name, data) => deliver({ gfs: 0, type: 'reponse', id: calls(name).at(-1).id, data });
  return { host, sent, listeners, deliver, calls, replyTo };
}

// Un stockage du navigateur pour l'app seule, ou un qui refuse tout (navigation privée).
function memoryStorage() {
  const map = new Map();
  return { getItem: key => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key), map };
}
const refusing = { getItem() { throw new Error('refusé'); }, setItem() { throw new Error('refusé'); }, removeItem() { throw new Error('refusé'); } };

async function quietly(run) {
  const warnings = [];
  const original = console.warn;
  console.warn = (...parts) => warnings.push(parts.map(String).join(' '));
  try { await run(); } finally { console.warn = original; }
  return warnings;
}

const CONTEXT = {
  contrat: 0, hote: 'GFS', instance: 'https://grist.example', document: 'doc1', page: 3, section: 5, adresseWidget: 'https://gfs.example/', culture: 'fr-FR',
  lectureSeule: false, acces: 'full', inconnu: 'pas gardé',
  langue: 'en', barre: { bord: 'gauche', epaisseur: 42, zone: { x: 0, y: 134, largeur: 42, hauteur: 132 } },
  stockage: { pp_theme: 'dark', 'clé avec espace': 'x', nombre: 3 },
  identite: { email: ' Ana@Exemple.org ', nom: 'pas gardé' },
  extensions: ['edition', 'Pas-Un-Id'], bibliotheques: { tiptap: { src: 'https://cdn.example/t.js', integrite: 'sha384-abc' }, mauvaise: { src: 1 } },
  ouverture: { fichier: { id: 16, type: 'document' }, type: 'document', dossier: 'Stock', raison: 'explorateur' },
};

async function hosted(context = CONTEXT, options = {}) {
  const fake = gfs(options);
  const link = createGfsLink({ host: fake.host, timeoutMs: 1000 });
  fake.replyTo('contexte', structuredClone(context));
  await link.ready;
  return { fake, link };
}

test('le lien de la page, sous Node, est celui d\'une app seule', async () => {
  await GfsLink.ready;
  assert.equal(GfsLink.hosted, false);
  assert.equal(GfsLink.context(), null);
});

test('seule : rien n\'est écouté ni envoyé, les choix vont au navigateur', async () => {
  const storage = memoryStorage();
  const fake = gfs({ search: '?language=fr', localStorage: storage });
  const link = createGfsLink({ host: fake.host });
  await link.ready;
  assert.equal(link.hosted, false);
  assert.deepEqual([link.context(), link.opening(), link.language(), link.bar(), link.extensions(), link.isAnswering()], [null, null, null, null, [], false]);
  assert.equal(link.storageSet('pp_theme', 'dark'), true);
  assert.equal(link.storageGet('pp_theme'), 'dark');
  assert.equal(link.storageSet('pp_theme', null), true);
  assert.equal(storage.map.has('pp_theme'), false);
  assert.equal(link.hideBar(true), false);
  assert.equal(link.opensInNewTab('mailto:a@b.c'), false);
  await assert.rejects(link.install('edition'), /GFS absent/);
  assert.equal(fake.listeners.length, 0);
  assert.equal(fake.sent.length, 0);
});

test('seule dans la page principale : `gfs=` sans cadre parent ne suffit pas', async () => {
  const fake = gfs();
  fake.host.parent = fake.host;
  const link = createGfsLink({ host: fake.host });
  await link.ready;
  assert.equal(link.hosted, false);
  assert.equal(fake.sent.length, 0);
});

test('seule, un navigateur qui refuse de garder : la lecture rend null, l\'écriture faux, rien ne s\'arrête', async () => {
  const link = createGfsLink({ host: gfs({ search: '', localStorage: refusing }).host });
  await link.ready;
  assert.equal(link.storageGet('pp_theme'), null);
  assert.equal(link.storageSet('pp_theme', 'dark'), false);
});

test('hébergée : le contexte est demandé une fois, au cadre parent ; seuls ses champs connus sont gardés', async () => {
  const { fake, link } = await hosted();
  assert.deepEqual(fake.sent[0], { message: { gfs: 0, type: 'appel', id: 1, nom: 'contexte' }, origin: '*' });
  assert.equal(fake.calls('contexte').length, 1);
  assert.equal(link.hosted, true);
  assert.equal(link.isAnswering(), true);
  const kept = link.context();
  assert.equal(kept.inconnu, undefined);
  assert.equal(kept.document, 'doc1');
  assert.equal(kept.acces, 'full');
  assert.equal(link.language(), 'en');
  assert.deepEqual(link.bar(), CONTEXT.barre);
  assert.deepEqual(link.identity(), { email: 'Ana@Exemple.org' }, 'l\'adresse telle que Grist la donne (casse gardée, blancs de bord retirés), rien d\'autre');
  assert.deepEqual(link.extensions(), ['edition']);
  assert.deepEqual(link.library('tiptap'), { src: 'https://cdn.example/t.js', integrite: 'sha384-abc', forme: 'script' });
  assert.equal(link.library('mauvaise'), null);
  assert.deepEqual(link.opening(), { fichier: { id: '16', type: 'document' }, type: 'document', dossier: 'Stock', raison: 'explorateur' });
  assert.equal(link.storageGet('pp_theme'), 'dark');
  assert.equal(link.storageGet('clé avec espace'), null);
  assert.equal(link.storageGet('nombre'), null);
});

test('ce que le lien rend est une copie : la changer ne change pas le lien', async () => {
  const { link } = await hosted();
  link.bar().zone.x = 999;
  link.context().document = 'autre';
  link.extensions().push('intrus');
  link.identity().email = 'autre@exemple.org';
  assert.equal(link.identity().email, 'Ana@Exemple.org');
  assert.equal(link.bar().zone.x, 0);
  assert.equal(link.context().document, 'doc1');
  assert.deepEqual(link.extensions(), ['edition']);
});

test('un GFS qui ne répond pas : `ready` passe après le délai, l\'app continue et le dit en console', async () => {
  const fake = gfs();
  let link;
  const warnings = await quietly(async () => { link = createGfsLink({ host: fake.host, timeoutMs: 20 }); await link.ready; });
  assert.equal(link.isAnswering(), false);
  assert.equal(link.context(), null);
  assert.match(warnings.join('\n'), /contexte indisponible/);
});

test('un message d\'un autre cadre, d\'un autre contrat ou sans enveloppe est ignoré', async () => {
  const fake = gfs();
  const link = createGfsLink({ host: fake.host, timeoutMs: 1000 });
  const id = fake.calls('contexte')[0].id;
  fake.deliver({ gfs: 0, type: 'reponse', id, data: { langue: 'en' } }, { postMessage() {} });
  fake.deliver({ gfs: 1, type: 'reponse', id, data: { langue: 'en' } });
  fake.deliver('pas un objet');
  assert.equal(link.isAnswering(), false);
  fake.replyTo('contexte', { langue: 'fr' });
  await link.ready;
  assert.equal(link.language(), 'fr');
});

test('événements : chaque abonné une fois par vrai changement, avec sa copie ; un événement inconnu est ignoré', async () => {
  const { fake, link } = await hosted();
  const seen = { langue: [], barre: [], extensions: [] };
  link.onLanguage(value => seen.langue.push(value));
  link.onBar(value => seen.barre.push(value));
  const stop = link.onExtensions(value => seen.extensions.push(value));
  const event = (nom, data) => fake.deliver({ gfs: 0, type: 'evenement', nom, data });
  event('langue', { langue: 'en' });
  event('langue', { langue: 'de' });
  event('langue', { langue: 'fr' });
  event('barre', { barre: CONTEXT.barre });
  event('barre', { barre: { bord: 'haut', epaisseur: 42, zone: { x: 288, y: 0, largeur: 124, hauteur: 42 } } });
  event('barre', { barre: { bord: 'diagonale', epaisseur: 42, zone: { x: 0, y: 0, largeur: 1, hauteur: 1 } } });
  event('extensions', { extensions: ['edition'], bibliotheques: CONTEXT.bibliotheques });
  event('extensions', { extensions: [], bibliotheques: {} });
  stop();
  event('extensions', { extensions: ['graphique'], bibliotheques: {} });
  event('effacer', { tout: true });
  assert.deepEqual(seen.langue, ['fr']);
  assert.deepEqual(seen.barre.map(bar => bar && bar.bord), ['haut', null]);
  assert.deepEqual(seen.extensions, [[]]);
  assert.deepEqual(link.extensions(), ['graphique']);
  assert.equal(link.bar(), null);
});

test('un abonné qui échoue n\'empêche pas les suivants', async () => {
  const { fake, link } = await hosted();
  const seen = [];
  link.onLanguage(() => { throw new Error('abonné cassé'); });
  link.onLanguage(value => seen.push(value));
  const warnings = await quietly(() => fake.deliver({ gfs: 0, type: 'evenement', nom: 'langue', data: { langue: 'fr' } }));
  assert.deepEqual(seen, ['fr']);
  assert.match(warnings.join('\n'), /abonné en échec/);
});

test('les choix de la personne chez GFS : la copie change, l\'appel part sans `id`, une clé hors règle ne part pas', async () => {
  const { fake, link } = await hosted();
  const before = fake.sent.length;
  assert.equal(link.storageSet('pp_theme', 'light'), true);
  assert.equal(link.storageGet('pp_theme'), 'light');
  assert.deepEqual(fake.sent.at(-1).message, { gfs: 0, type: 'appel', nom: 'stockage.ecrire', args: { cle: 'pp_theme', valeur: 'light' } });
  assert.equal(link.storageSet('pp_theme', null), true);
  assert.equal(link.storageGet('pp_theme'), null);
  assert.deepEqual(fake.sent.at(-1).message.args, { cle: 'pp_theme', valeur: null });
  assert.equal(link.storageSet('clé avec espace', 'x'), false);
  assert.equal(link.storageSet('x'.repeat(65), 'x'), false);
  assert.equal(link.storageSet('pp_zoom', 3), false);
  assert.equal(fake.sent.length, before + 2);
});

test('un GFS qui ne rend pas d\'espace : rien ne se garde, rien ne part', async () => {
  const { fake, link } = await hosted({ langue: 'fr' });
  const before = fake.sent.length;
  assert.equal(link.storageGet('pp_theme'), null);
  assert.equal(link.storageSet('pp_theme', 'dark'), false);
  assert.equal(fake.sent.length, before);
});

test('`ouvrir` arrivé avant l\'inscription attend ; la réponse reprend son `id`', async () => {
  const { fake, link } = await hosted();
  fake.deliver({ gfs: 0, type: 'appel', id: 7, nom: 'ouvrir', args: { fichier: { id: 17, type: 'grille' }, type: 'grille', dossier: '', raison: 'explorateur' } });
  const before = fake.sent.length;
  const asked = [];
  link.onOpen(request => { asked.push(request); return true; });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(asked, [{ fichier: { id: '17', type: 'grille' }, type: 'grille', dossier: '', raison: 'explorateur' }]);
  assert.equal(fake.sent.length, before + 1);
  assert.deepEqual(fake.sent.at(-1).message, { gfs: 0, id: 7, type: 'reponse', data: { ouvert: true } });
});

test('`ouvrir` : une ouverture renoncée rend faux, un échec part avec son texte, un appel sans `id` n\'a pas de réponse', async () => {
  const { fake, link } = await hosted();
  const answers = [false, new Error('Modèle introuvable'), true];
  link.onOpen(() => { const next = answers.shift(); if (next instanceof Error) throw next; return Promise.resolve(next); });
  const open = (id) => fake.deliver({ gfs: 0, type: 'appel', ...(id === undefined ? {} : { id }), nom: 'ouvrir', args: { fichier: null, type: 'document' } });
  const warnings = await quietly(async () => {
    open(8);
    open(9);
    await new Promise(resolve => setTimeout(resolve, 0));
  });
  const before = fake.sent.length;
  open();
  await new Promise(resolve => setTimeout(resolve, 0));
  const replies = fake.sent.map(entry => entry.message).filter(message => message.id === 8 || message.id === 9);
  assert.deepEqual(replies, [{ gfs: 0, id: 8, type: 'reponse', data: { ouvert: false } }, { gfs: 0, id: 9, type: 'erreur', message: 'Modèle introuvable' }]);
  assert.match(warnings.join('\n'), /ouverture demandée par GFS en échec/);
  assert.equal(fake.sent.length, before);
});

// ---------- `fermer` : GFS va remplacer l'app (contrats de GFS, 5.4 point 3) ----------

const close = (fake, id, args = { raison: 'explorateur' }) => fake.deliver({ gfs: 0, type: 'appel', ...(id === undefined ? {} : { id }), nom: 'fermer', args });
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('`fermer` : l\'abonné reçoit la raison ; vrai laisse partir l\'app, faux la garde, et la réponse reprend l\'`id`', async () => {
  const { fake, link } = await hosted();
  const asked = [];
  const answers = [true, false, undefined, 'oui'];
  link.onClose(request => { asked.push(request); return Promise.resolve(answers.shift()); });
  [11, 12, 13, 14].forEach(id => close(fake, id));
  await tick();
  assert.deepEqual(asked, Array(4).fill({ raison: 'explorateur' }));
  const replies = fake.sent.map(entry => entry.message).filter(message => [11, 12, 13, 14].includes(message.id));
  assert.deepEqual(replies.map(reply => [reply.id, reply.type, reply.data.ferme]), [[11, 'reponse', true], [12, 'reponse', false], [13, 'reponse', false], [14, 'reponse', false]],
    'seul `true` laisse partir l\'app : rien d\'autre ne ferme');
});

test('`fermer` : une raison qui n\'est pas du texte devient vide, une raison longue est coupée ; une erreur part avec son texte et un appel sans `id` n\'a pas de réponse', async () => {
  const { fake, link } = await hosted();
  const asked = [];
  let fail = false;
  link.onClose((request) => { asked.push(request.raison); if (fail) throw new Error('Enregistrement refusé'); return true; });
  close(fake, 20, { raison: 42 });
  close(fake, 21, { raison: 'x'.repeat(100) });
  close(fake, 22, null);
  await tick();
  assert.deepEqual(asked, ['', 'x'.repeat(40), '']);
  fail = true;
  const warnings = await quietly(async () => { close(fake, 23); await tick(); });
  assert.deepEqual(fake.sent.at(-1).message, { gfs: 0, id: 23, type: 'erreur', message: 'Enregistrement refusé' });
  assert.match(warnings.join('\n'), /fermeture demandée par GFS en échec/);
  const before = fake.sent.length;
  close(fake);
  await tick();
  assert.equal(fake.sent.length, before, 'un appel sans `id` n\'attend pas de réponse');
});

test('`fermer` sans abonné reçoit `GFS_INCONNU` : l\'app part comme avant ; se désabonner y revient', async () => {
  const { fake, link } = await hosted();
  close(fake, 30);
  assert.deepEqual([fake.sent.at(-1).message.type, fake.sent.at(-1).message.code], ['erreur', 'GFS_INCONNU']);
  const off = link.onClose(() => true);
  close(fake, 31);
  await tick();
  assert.equal(fake.sent.at(-1).message.data.ferme, true);
  off();
  close(fake, 32);
  assert.equal(fake.sent.at(-1).message.code, 'GFS_INCONNU');
  const second = link.onClose(() => false);
  const first = link.onClose(() => true);
  second();
  close(fake, 33);
  await tick();
  assert.equal(fake.sent.at(-1).message.data.ferme, true, 'se désabonner d\'un abonné remplacé ne retire pas le nouveau');
  first();
});

test('`fermer` ne vient que du cadre parent : un autre cadre n\'obtient aucun appel d\'abonné', async () => {
  const { fake, link } = await hosted();
  let called = 0;
  link.onClose(() => { called++; return true; });
  const before = fake.sent.length;
  fake.deliver({ gfs: 0, type: 'appel', id: 40, nom: 'fermer', args: { raison: 'app' } }, { postMessage() {} });
  await tick();
  assert.equal(called, 0);
  assert.equal(fake.sent.length, before);
});

test('un appel inconnu de GFS reçoit `GFS_INCONNU`, avec son `id`', async () => {
  const { fake } = await hosted();
  fake.deliver({ gfs: 0, type: 'appel', id: 3, nom: 'effacer' });
  const answer = fake.sent.at(-1).message;
  assert.deepEqual([answer.type, answer.id, answer.code], ['erreur', 3, 'GFS_INCONNU']);
});

test('installer : une seule demande par extension tant que la fenêtre de GFS est ouverte ; un refus garde son code', async () => {
  const { fake, link } = await hosted();
  const first = link.install('edition');
  const second = link.install('edition');
  assert.equal(fake.calls('installer').length, 1);
  assert.deepEqual(fake.calls('installer')[0].args, { extension: 'edition' });
  fake.replyTo('installer', { actives: ['edition', 'Pas-Un-Id'] });
  assert.deepEqual(await first, ['edition']);
  assert.deepEqual(await second, ['edition']);
  const third = link.install('edition');
  assert.equal(fake.calls('installer').length, 2);
  fake.deliver({ gfs: 0, type: 'erreur', id: fake.calls('installer')[1].id, code: 'GFS_REFUSE', message: 'Lecture seule' });
  await assert.rejects(third, error => error.code === 'GFS_REFUSE' && /Lecture seule/.test(error.message));
});

test('choose : la demande part telle qu\'elle est écrite, la réponse est une clé { app, id, nom, type } ; annuler rend null ; une forme inconnue vaut null', async () => {
  const { fake, link } = await hosted();
  const chosen = link.choose({ types: ['document', 'grille', 'document', '', 7], apps: ['publipostage'], titre: 'Lier un modèle' });
  assert.equal(fake.calls('choisir').length, 1);
  assert.deepEqual(fake.calls('choisir')[0].args, { types: ['document', 'grille'], apps: ['publipostage'], titre: 'Lier un modèle' });
  fake.replyTo('choisir', { app: 'publipostage', id: 16, nom: 'Contrat', type: 'document', inconnu: 'pas gardé' });
  assert.deepEqual(await chosen, { app: 'publipostage', id: '16', nom: 'Contrat', type: 'document' });
  const cancelled = link.choose({ types: ['document'] });
  assert.deepEqual(fake.calls('choisir')[1].args, { types: ['document'] }, 'sans apps ni titre, rien de plus ne part');
  fake.replyTo('choisir', null);
  assert.equal(await cancelled, null);
  const odd = link.choose({ types: ['document'] });
  fake.replyTo('choisir', { app: 'publipostage', type: 'document' });
  assert.equal(await odd, null, 'une réponse sans id n\'est pas une clé : l\'app ne lie rien');
});

test('choose : une seule demande à la fois (la même rend la même promesse), un refus garde son code, sans types rien ne part', async () => {
  const { fake, link } = await hosted();
  const first = link.choose({ types: ['document'] });
  const same = link.choose({ types: ['document'] });
  assert.equal(fake.calls('choisir').length, 1);
  await assert.rejects(link.choose({ types: ['grille'] }), error => error.code === 'GFS_REFUSE' && /déjà en cours/.test(error.message));
  assert.equal(fake.calls('choisir').length, 1);
  fake.replyTo('choisir', { app: 'publipostage', id: '1', nom: 'A', type: 'document' });
  assert.equal((await first).id, '1');
  assert.equal((await same).id, '1');
  const next = link.choose({ types: ['grille'] });
  assert.equal(fake.calls('choisir').length, 2, 'le choix fini, un autre peut partir');
  fake.deliver({ gfs: 0, type: 'erreur', id: fake.calls('choisir')[1].id, code: 'GFS_REFUSE', message: 'Une forme hors règle' });
  await assert.rejects(next, error => error.code === 'GFS_REFUSE' && /hors règle/.test(error.message));
  const before = fake.sent.length;
  for (const bad of [undefined, {}, { types: [] }, { types: 'document' }]) await assert.rejects(link.choose(bad), error => error.code === 'GFS_REFUSE');
  assert.equal(fake.sent.length, before);
});

test('openFile : la clé part en { app, fichier: { id, type } } ; la réponse dit si l\'app a ouvert ; un fichier disparu garde son code', async () => {
  const { fake, link } = await hosted();
  const opened = link.openFile({ app: 'publipostage', id: 16, type: 'document', nom: 'pas envoyé' });
  const same = link.openFile({ app: 'publipostage', id: '16', type: 'document' });
  assert.equal(fake.calls('ouvrir').length, 1);
  assert.deepEqual(fake.calls('ouvrir')[0].args, { app: 'publipostage', fichier: { id: '16', type: 'document' } });
  fake.replyTo('ouvrir', { ouvert: true });
  assert.equal(await opened, true);
  assert.equal(await same, true);
  const declined = link.openFile({ app: 'publipostage', id: '17', type: 'document' });
  fake.replyTo('ouvrir', { ouvert: false });
  assert.equal(await declined, false);
  const gone = link.openFile({ app: 'publipostage', id: '18', type: 'document' });
  fake.deliver({ gfs: 0, type: 'erreur', id: fake.calls('ouvrir').at(-1).id, code: 'GFS_INTROUVABLE', message: 'Le fichier 18 n\'est plus là' });
  await assert.rejects(gone, error => error.code === 'GFS_INTROUVABLE' && /n'est plus là/.test(error.message));
  const before = fake.sent.length;
  for (const bad of [undefined, {}, { app: 'publipostage' }, { app: 'publipostage', id: ' ', type: 'document' }, { id: '1', type: 'document' }]) await assert.rejects(link.openFile(bad), error => error.code === 'GFS_REFUSE');
  assert.equal(fake.sent.length, before);
});

test('seule : choose, openFile et deposit refusent sans rien envoyer', async () => {
  const fake = gfs({ search: '?language=fr' });
  const link = createGfsLink({ host: fake.host });
  await link.ready;
  await assert.rejects(link.choose({ types: ['document'] }), /GFS absent/);
  await assert.rejects(link.openFile({ app: 'a', id: '1', type: 't' }), /GFS absent/);
  await assert.rejects(link.deposit({ fichier: new File(['%PDF'], 'a.pdf'), nom: 'a.pdf' }), /GFS absent/);
  await assert.rejects(link.attach({ table: 'Clients', colonne: 'Pdf', fichiers: [{ ligne: 1, fichier: new File(['%PDF'], 'a.pdf'), nom: 'a.pdf' }] }), /GFS absent/);
  assert.equal(fake.sent.length, 0);
});

// Le rangement d'un export (5.4, point 9). Le GFS d'essai note ce qui part en le copiant (`structuredClone`) : un `File` y devient un `Blob` sans nom, ses octets restent.
const PDF = () => new File(['%PDF-1.4 export'], 'Facture.pdf', { type: 'application/pdf' });

test('deposit : la demande part telle qu\'elle est écrite — les octets du fichier, le nom, le lot, ce qui reste à ranger, le dossier —, la réponse est { statut, id (texte), nom }', async () => {
  const { fake, link } = await hosted();
  const deposited = link.deposit({ fichier: PDF(), nom: 'Facture', type: 'pdf', lot: 'export-3', suivants: 11, dossier: 'Factures/2026', inconnu: 'pas envoyé' });
  assert.equal(fake.calls('ranger').length, 1);
  const { fichier, ...rest } = fake.calls('ranger')[0].args;
  assert.deepEqual(rest, { nom: 'Facture', type: 'pdf', lot: 'export-3', suivants: 11, dossier: 'Factures/2026' });
  assert.equal(await fichier.text(), '%PDF-1.4 export');
  fake.replyTo('ranger', { statut: 'copie', id: 7, nom: 'Facture (1).pdf', inconnu: 'pas gardé' });
  assert.deepEqual(await deposited, { statut: 'copie', id: '7', nom: 'Facture (1).pdf' });
});

test('deposit : ce qui n\'est pas donné ne part pas (mais « suivants: 0 », le dernier du lot, part)', async () => {
  const { fake, link } = await hosted();
  link.deposit({ fichier: PDF(), nom: 'A.pdf' });
  link.deposit({ fichier: PDF(), nom: 'B.pdf', lot: undefined, type: undefined, suivants: 0, dossier: undefined });
  const [first, second] = fake.calls('ranger');
  assert.deepEqual(Object.keys(first.args).sort(), ['fichier', 'nom']);
  assert.deepEqual(Object.keys(second.args).sort(), ['fichier', 'nom', 'suivants']);
  assert.equal(second.args.suivants, 0);
});

test('deposit : les quatre statuts de GFS sont rendus ; « ignore » n\'a ni id ni nom ; un statut d\'un GFS plus récent n\'est pas pris pour un autre ; une réponse vide ne dit rien', async () => {
  const { fake, link } = await hosted();
  const replies = [
    [{ statut: 'ajoute', id: 'a1', nom: 'A.pdf' }, { statut: 'ajoute', id: 'a1', nom: 'A.pdf' }],
    [{ statut: 'remplace', id: 'a1', nom: 'A.pdf' }, { statut: 'remplace', id: 'a1', nom: 'A.pdf' }],
    [{ statut: 'copie', id: 'a2', nom: 'A (1).pdf' }, { statut: 'copie', id: 'a2', nom: 'A (1).pdf' }],
    [{ statut: 'ignore', id: null, nom: null }, { statut: 'ignore', id: null, nom: null }],
    [{ statut: 'plus-tard', id: 3, nom: 'B.pdf' }, { statut: 'plus-tard', id: '3', nom: 'B.pdf' }],
    [null, { statut: '', id: null, nom: null }],
    [{ statut: 'ajoute', id: ' ', nom: '' }, { statut: 'ajoute', id: null, nom: null }],
  ];
  for (const [reply, expected] of replies) {
    const request = link.deposit({ fichier: PDF(), nom: 'A.pdf' });
    fake.replyTo('ranger', reply);
    assert.deepEqual(await request, expected);
  }
});

test('deposit : un refus de GFS garde son code et sa phrase — dont GFS_INCONNU, d\'un GFS qui ne sait pas encore ranger — et le dépôt suivant part quand même', async () => {
  const { fake, link } = await hosted();
  for (const code of ['GFS_REFUSE', 'GFS_ACCES', 'GFS_LECTURE_SEULE', 'GFS_ANNULE', 'GFS_ECHEC', 'GFS_INACTIF', 'GFS_INCONNU']) {
    const request = link.deposit({ fichier: PDF(), nom: 'A.pdf' });
    fake.deliver({ gfs: 0, type: 'erreur', id: fake.calls('ranger').at(-1).id, code, message: `dit ${code}` });
    await assert.rejects(request, error => error.code === code && error.message === `dit ${code}`);
  }
  assert.equal(fake.calls('ranger').length, 7);
});

test('deposit : deux demandes sont deux fichiers (deux appels, chacun sa réponse, pas le partage de choose) et la personne a tout son temps : aucun délai', async () => {
  const fake = gfs();
  const link = createGfsLink({ host: fake.host, timeoutMs: 20 });
  fake.replyTo('contexte', structuredClone(CONTEXT));
  await link.ready;
  const first = link.deposit({ fichier: PDF(), nom: 'A.pdf' });
  const second = link.deposit({ fichier: PDF(), nom: 'A.pdf' });
  const [one, two] = fake.calls('ranger');
  assert.equal(fake.calls('ranger').length, 2);
  assert.notEqual(one.id, two.id);
  await new Promise(resolve => setTimeout(resolve, 90));
  fake.deliver({ gfs: 0, type: 'reponse', id: two.id, data: { statut: 'copie', id: 's2', nom: 'A (1).pdf' } });
  fake.deliver({ gfs: 0, type: 'reponse', id: one.id, data: { statut: 'ajoute', id: 's1', nom: 'A.pdf' } });
  assert.deepEqual([(await first).id, (await second).id], ['s1', 's2']);
});

test('deposit : une demande hors règle ne part pas (GFS_REFUSE) — pas de fichier, un texte ou des octets sans File, pas de nom', async () => {
  const { fake, link } = await hosted();
  const before = fake.sent.length;
  const bad = [undefined, null, 'A.pdf', {}, { nom: 'A.pdf' }, { fichier: '%PDF-1.4', nom: 'A.pdf' }, { fichier: new Uint8Array([37, 80]), nom: 'A.pdf' }, { fichier: { size: 3 }, nom: 'A.pdf' },
    { fichier: PDF() }, { fichier: PDF(), nom: '  ' }, { fichier: PDF(), nom: 4 }];
  for (const request of bad) await assert.rejects(link.deposit(request), error => error.code === 'GFS_REFUSE');
  assert.equal(fake.sent.length, before);
});

// La jointure d'un PDF à la cellule de sa ligne (5.4, point 12).
const ATTACH = (over = {}) => ({ table: 'Clients', colonne: 'Pdf', fichiers: [{ ligne: 3, fichier: PDF(), nom: 'Facture.pdf' }, { ligne: 3, fichier: PDF(), nom: 'Devis.pdf' }], ...over });

test('attach : la demande part telle qu\'elle est écrite — table, colonne, mode, et pour chaque fichier la ligne, les octets et le nom —, la réponse est { colonne, probleme, joints, echecs }', async () => {
  const { fake, link } = await hosted();
  const attached = link.attach(ATTACH({ mode: 'ajouter', inconnu: 'pas envoyé' }));
  assert.equal(fake.calls('joindre').length, 1);
  const { args } = fake.calls('joindre')[0];
  assert.deepEqual(Object.keys(args).sort(), ['colonne', 'fichiers', 'mode', 'table']);
  assert.deepEqual([args.table, args.colonne, args.mode], ['Clients', 'Pdf', 'ajouter']);
  assert.deepEqual(args.fichiers.map(each => [each.ligne, each.nom, Object.keys(each).sort().join()]), [[3, 'Facture.pdf', 'fichier,ligne,nom'], [3, 'Devis.pdf', 'fichier,ligne,nom']]);
  assert.equal(await args.fichiers[0].fichier.text(), '%PDF-1.4 export');
  fake.replyTo('joindre', { colonne: 'Pdf', probleme: null, joints: [{ index: 0, remplace: true, inconnu: 1 }, { index: 1 }], echecs: [], inconnu: 'pas gardé' });
  assert.deepEqual(await attached, { colonne: 'Pdf', probleme: null, joints: [{ index: 0, remplace: true }, { index: 1, remplace: false }], echecs: [] });
});

test('attach : « mode » ne part pas quand il n\'est pas donné ; un mot de problème d\'un GFS plus récent est rendu tel quel ; une réponse vide ne dit rien', async () => {
  const { fake, link } = await hosted();
  const first = link.attach(ATTACH());
  assert.equal('mode' in fake.calls('joindre')[0].args, false);
  fake.replyTo('joindre', { colonne: 'Pdf', probleme: 'quota', joints: [], echecs: [{ index: 0, raison: 'quota' }, { index: 'x', raison: 'ignoré' }, 'pas un objet'] });
  assert.deepEqual(await first, { colonne: 'Pdf', probleme: 'quota', joints: [], echecs: [{ index: 0, raison: 'quota' }] });
  const empty = link.attach(ATTACH());
  fake.replyTo('joindre', undefined);
  assert.deepEqual(await empty, { colonne: '', probleme: null, joints: [], echecs: [] });
});

test('attach : un refus de GFS garde son code et sa phrase — dont GFS_INCONNU, d\'un GFS qui ne sait pas encore joindre — et la demande suivante part quand même', async () => {
  const { fake, link } = await hosted();
  for (const code of ['GFS_REFUSE', 'GFS_LECTURE_SEULE', 'GFS_INACTIF', 'GFS_INCONNU']) {
    const request = link.attach(ATTACH());
    fake.deliver({ gfs: 0, type: 'erreur', id: fake.calls('joindre').at(-1).id, code, message: `dit ${code}` });
    await assert.rejects(request, error => error.code === code && error.message === `dit ${code}`);
  }
  assert.equal(fake.calls('joindre').length, 4);
});

test('attach : une demande hors règle ne part pas (GFS_REFUSE) — ni table ni colonne, pas de fichier, une ligne qui n\'est pas un numéro, des octets sans File, pas de nom', async () => {
  const { fake, link } = await hosted();
  const before = fake.sent.length;
  const file = (over = {}) => ({ ligne: 1, fichier: PDF(), nom: 'A.pdf', ...over });
  const bad = [undefined, null, 'Clients', {}, ATTACH({ table: '' }), ATTACH({ table: 4 }), ATTACH({ colonne: ' ' }), ATTACH({ colonne: undefined }), ATTACH({ fichiers: [] }), ATTACH({ fichiers: undefined }), ATTACH({ fichiers: file() }),
    ATTACH({ fichiers: [file({ ligne: 0 })] }), ATTACH({ fichiers: [file({ ligne: 1.5 })] }), ATTACH({ fichiers: [file({ ligne: '3' })] }), ATTACH({ fichiers: [file({ fichier: '%PDF-1.4' })] }), ATTACH({ fichiers: [file({ fichier: new Uint8Array([37]) })] }),
    ATTACH({ fichiers: [file({ nom: '  ' })] }), ATTACH({ fichiers: [file({ nom: undefined })] }), ATTACH({ fichiers: [file(), null] })];
  for (const request of bad) await assert.rejects(link.attach(request), error => error.code === 'GFS_REFUSE');
  assert.equal(fake.sent.length, before);
});

test('attach : deux demandes sont deux appels, chacun sa réponse, et GFS prend tout son temps : aucun délai', async () => {
  const fake = gfs();
  const link = createGfsLink({ host: fake.host, timeoutMs: 20 });
  fake.replyTo('contexte', structuredClone(CONTEXT));
  await link.ready;
  const first = link.attach(ATTACH());
  const second = link.attach(ATTACH());
  const [one, two] = fake.calls('joindre');
  assert.notEqual(one.id, two.id);
  await new Promise(resolve => setTimeout(resolve, 90));
  fake.deliver({ gfs: 0, type: 'reponse', id: two.id, data: { colonne: 'Pdf', probleme: 'refus', joints: [], echecs: [{ index: 0, raison: 'refus' }] } });
  fake.deliver({ gfs: 0, type: 'reponse', id: one.id, data: { colonne: 'Pdf', probleme: null, joints: [{ index: 0, remplace: false }], echecs: [] } });
  assert.deepEqual([(await first).probleme, (await second).probleme], [null, 'refus']);
});

test('l\'ouverture garde le fichier que GFS passe — `lecture` { id (texte), fichier } du contexte, `importation` { valeur, fichier } de l\'appel `ouvrir` — tel quel, sans clé de plus quand il n\'y en a pas', async () => {
  const fake = gfs();
  const link = createGfsLink({ host: fake.host, timeoutMs: 1000 });
  const pdf = PDF();
  fake.replyTo('contexte', { ...CONTEXT, ouverture: { fichier: null, type: 'pdf', dossier: 'Factures', raison: 'lire', lecture: { id: 12, fichier: pdf }, inconnu: 'pas gardé' } });
  await link.ready;
  const opening = link.opening();
  assert.deepEqual(Object.keys(opening).sort(), ['dossier', 'fichier', 'lecture', 'raison', 'type']);
  assert.deepEqual([opening.fichier, opening.type, opening.dossier, opening.raison, opening.lecture.id], [null, 'pdf', 'Factures', 'lire', '12']);
  assert.equal(opening.lecture.fichier, pdf, 'le même File, pas une copie');
  opening.dossier = 'changé';
  opening.lecture.id = 'changé';
  assert.deepEqual([link.opening().dossier, link.opening().lecture.id], ['Factures', '12'], 'chaque lecture a sa copie');

  const seen = [];
  link.onOpen((request) => { seen.push(request); return true; });
  const docx = new File(['x'], 'modele.docx');
  fake.deliver({ gfs: 0, type: 'appel', id: 5, nom: 'ouvrir', args: { fichier: null, type: 'document', dossier: '', raison: 'importer', importation: { valeur: 'docx', fichier: docx } } });
  assert.equal(seen[0].importation.fichier, docx);
  assert.equal(seen[0].importation.valeur, 'docx');
  assert.deepEqual(Object.keys(seen[0]).sort(), ['dossier', 'fichier', 'importation', 'raison', 'type']);
  fake.deliver({ gfs: 0, type: 'appel', id: 6, nom: 'ouvrir', args: { fichier: { id: 16, type: 'document' }, type: 'document', dossier: '', raison: 'explorateur' } });
  assert.deepEqual(Object.keys(seen[1]).sort(), ['dossier', 'fichier', 'raison', 'type'], 'sans fichier passé, ni `importation` ni `lecture`');
});

test('l\'ouverture ne garde ni `importation` ni `lecture` qui ne portent pas un File ou un Blob, ni une `lecture` sans identifiant', async () => {
  const fake = gfs();
  const link = createGfsLink({ host: fake.host, timeoutMs: 1000 });
  fake.replyTo('contexte', { ...CONTEXT, ouverture: { fichier: null, type: 'pdf', dossier: '', raison: 'lire', lecture: { id: 3, fichier: { name: 'x.pdf', size: 3 } }, importation: 'docx' } });
  await link.ready;
  assert.deepEqual(Object.keys(link.opening()).sort(), ['dossier', 'fichier', 'raison', 'type']);
  const seen = [];
  link.onOpen((request) => { seen.push(request); return false; });
  fake.deliver({ gfs: 0, type: 'appel', id: 8, nom: 'ouvrir', args: { fichier: null, type: 'pdf', dossier: '', raison: 'lire', lecture: { id: ' ', fichier: PDF() }, importation: { valeur: 'docx', fichier: 'texte' } } });
  assert.deepEqual(Object.keys(seen[0]).sort(), ['dossier', 'fichier', 'raison', 'type']);
  fake.deliver({ gfs: 0, type: 'appel', id: 9, nom: 'ouvrir', args: { fichier: null, type: 'document', dossier: '', raison: 'importer', importation: { fichier: PDF() } } });
  assert.equal(seen[1].importation.valeur, '', 'une valeur absente vaut un texte vide');
  assert.ok(seen[1].importation.fichier instanceof Blob);
});

test('barre.masquer part sans `id` ; une valeur qui n\'est ni vraie ni fausse ne part pas', async () => {
  const { fake, link } = await hosted();
  assert.equal(link.hideBar(true), true);
  assert.deepEqual(fake.sent.at(-1).message, { gfs: 0, type: 'appel', nom: 'barre.masquer', args: { masquee: true } });
  const before = fake.sent.length;
  assert.equal(link.hideBar('oui'), false);
  assert.equal(fake.sent.length, before);
});

test('un lien mailto: ou tel: s\'ouvre dans un nouvel onglet chez GFS, pas une adresse ordinaire', async () => {
  const { link } = await hosted();
  assert.equal(link.opensInNewTab(' MAILTO:a@b.c'), true);
  assert.equal(link.opensInNewTab('tel:+33100000000'), true);
  assert.equal(link.opensInNewTab('https://example.com'), false);
  assert.equal(link.opensInNewTab(null), false);
});

test('identité : le contexte la donne, l\'événement la change une fois par vrai changement ; une forme qui n\'est pas une adresse vaut null', async () => {
  const without = await hosted({ ...CONTEXT, identite: null });
  assert.equal(without.link.identity(), null, 'GFS ne l\'a pas donnée (app qui ne l\'a pas déclarée, ou GFS ne la connaît pas)');
  const { fake, link } = await hosted({ ...CONTEXT, identite: undefined });
  const seen = [];
  const stop = link.onIdentity(value => seen.push(value));
  const event = data => fake.deliver({ gfs: 0, type: 'evenement', nom: 'identite', data });
  event({ identite: { email: 'ana@exemple.org' } });
  event({ identite: { email: 'ana@exemple.org' } });
  event({ identite: { email: 'pas une adresse' } });
  event({ identite: 'ana@exemple.org' });
  event({ identite: { email: 'ben@exemple.org' } });
  event({ identite: null });
  stop();
  event({ identite: { email: 'cleo@exemple.org' } });
  assert.deepEqual(seen, [{ email: 'ana@exemple.org' }, null, { email: 'ben@exemple.org' }, null], 'un abonné par vrai changement, la copie de chaque valeur');
  assert.deepEqual(link.identity(), { email: 'cleo@exemple.org' }, 'le lien garde la dernière, même désabonné');
});

test('identité : le contexte d\'un GFS d\'avant (sans `identite`) et l\'app seule la laissent à null', async () => {
  const { identite, ...old } = CONTEXT;
  assert.equal(identite.email.trim(), 'Ana@Exemple.org');
  const { link } = await hosted(old);
  assert.equal(link.identity(), null);
  const alone = createGfsLink({ host: { location: { search: '' } } });
  await alone.ready;
  assert.equal(alone.identity(), null);
  const calls = [];
  alone.onIdentity(value => calls.push(value))();
  assert.deepEqual(calls, [], 'seule : rien n\'est écouté, aucun appel');
});

// Le message d'ambiance (5.2, point 10), réduit : GFS en donne dix-neuf jetons de couleur par mode et les jetons de forme (test/ambiance.test.mjs lit un vrai message).
const AMBIANCE = { id: 'pop', couleur: '#6d4fd6', ajustee: false, clair: { '--bg': '#eae9ff', '--accent': '#6d4fd6' }, sombre: { '--bg': '#16132a', '--accent': '#9a85ff' }, forme: { '--radius-md': '14px' } };

test('ambiance : le contexte la donne, l\'événement la change une fois par vrai changement ; une forme inconnue vaut null', async () => {
  const none = await hosted({ ...CONTEXT, ambiance: null });
  assert.equal(none.link.ambiance(), null, 'rien n\'est choisi : l\'app garde ses couleurs');
  const { fake, link } = await hosted({ ...CONTEXT, ambiance: AMBIANCE });
  assert.deepEqual(link.ambiance(), AMBIANCE);
  const seen = [];
  const stop = link.onAmbiance(value => seen.push(value));
  const event = data => fake.deliver({ gfs: 0, type: 'evenement', nom: 'ambiance', data });
  event({ ambiance: structuredClone(AMBIANCE) });
  event({ ambiance: { ...AMBIANCE, id: 'brut', couleur: null } });
  event({ ambiance: { ...AMBIANCE, id: 'brut', couleur: null } });
  event({ ambiance: 'brut' });
  event({ ambiance: null });
  event({ ambiance: { ...AMBIANCE, id: 'neon' } });
  event({ ambiance: { id: 'neon' } });
  stop();
  event({ ambiance: { ...AMBIANCE, id: 'papier' } });
  assert.deepEqual(seen.map(value => value && value.id), ['brut', null, 'neon', null], 'un abonné par vrai changement (le même message redit n\'en est pas un)');
  assert.deepEqual(link.ambiance().id, 'papier', 'le lien garde la dernière, même désabonné');
});

test('ambiance : le contexte rappelle l\'abonné, la valeur rendue est une copie', async () => {
  const fake = gfs();
  const link = createGfsLink({ host: fake.host, timeoutMs: 1000 });
  const seen = [];
  link.onAmbiance(value => seen.push(value));
  fake.replyTo('contexte', structuredClone({ ...CONTEXT, ambiance: AMBIANCE }));
  await link.ready;
  assert.deepEqual(seen, [AMBIANCE]);
  link.ambiance().clair['--accent'] = '#000000';
  assert.equal(link.ambiance().clair['--accent'], '#6d4fd6');
});

test('ambiance : le contexte d\'un GFS d\'avant (sans `ambiance`) et l\'app seule la laissent à null', async () => {
  const { link } = await hosted(CONTEXT);
  assert.equal(link.ambiance(), null);
  const alone = createGfsLink({ host: { location: { search: '' } } });
  await alone.ready;
  assert.equal(alone.ambiance(), null);
  const calls = [];
  alone.onAmbiance(value => calls.push(value))();
  assert.deepEqual(calls, [], 'seule : rien n\'est écouté, aucun appel');
});

test('ambiance : l\'événement d\'un autre cadre n\'est pas lu', async () => {
  const { fake, link } = await hosted(CONTEXT);
  fake.deliver({ gfs: 0, type: 'evenement', nom: 'ambiance', data: { ambiance: AMBIANCE } }, { postMessage() {} });
  assert.equal(link.ambiance(), null);
});

// ---------- `supprimer` et `dupliquer` : un fichier qui tient à plus qu'une ligne (contrats de GFS, 5.4 points 10 et 11) ----------

const fileCall = (fake, id, nom, args) => fake.deliver({ gfs: 0, type: 'appel', ...(id === undefined ? {} : { id }), nom, args });
const replyTo = (fake, id) => fake.sent.map(entry => entry.message).filter(message => message.id === id).at(-1);

test('`supprimer` : l\'abonné reçoit le fichier et la raison ; `{ fait }` ou un simple booléen, `dit` suit quand c\'est une phrase, et la réponse reprend l\'`id`', async () => {
  const { fake, link } = await hosted();
  const asked = [];
  const answers = [{ fait: true }, { fait: false, dit: 'Un lien public est encore ouvert.' }, true, false, undefined, { fait: 'oui', dit: 42 }, { fait: true, dit: 'y'.repeat(300) }];
  link.onDelete(request => { asked.push(request); return Promise.resolve(answers.shift()); });
  const args = { fichier: { id: 7, type: 'formulaire' }, raison: 'corbeille' };
  [50, 51, 52, 53, 54, 55, 56].forEach(id => fileCall(fake, id, 'supprimer', args));
  await tick();
  assert.deepEqual(asked, Array(7).fill({ fichier: { id: 7, type: 'formulaire' }, raison: 'corbeille' }));
  assert.deepEqual([50, 51, 52, 53, 54, 55, 56].map(id => replyTo(fake, id).data), [
    { fait: true }, { fait: false, dit: 'Un lien public est encore ouvert.' }, { fait: true }, { fait: false }, { fait: false }, { fait: false }, { fait: true, dit: 'y'.repeat(200) },
  ], 'seul `true` ferme ; une phrase vide ou qui n\'en est pas une ne part pas ; la phrase est coupée à 200 signes');
  assert.ok([50, 51].every(id => replyTo(fake, id).type === 'reponse'));
});

test('`dupliquer` : l\'abonné reçoit le fichier et le nom libre ; `{ id, nom?, dit? }` part tel quel, une réponse sans `id` (ou vide) dit seulement qu\'il n\'a rien copié', async () => {
  const { fake, link } = await hosted();
  const asked = [];
  const answers = [{ id: 12 }, { id: 'abc', nom: 'Inscription (2)', dit: 'Copie fermée.' }, { dit: 'Rien à copier.' }, { id: '' , nom: 'x' }, undefined, { id: {}, dit: 'x' }, { nom: 'sans id' }];
  link.onDuplicate(request => { asked.push(request); return Promise.resolve(answers.shift()); });
  const args = { fichier: { id: 'f1', type: 'formulaire' }, nom: 'Inscription (1)' };
  [60, 61, 62, 63, 64, 65, 66].forEach(id => fileCall(fake, id, 'dupliquer', args));
  await tick();
  assert.deepEqual(asked, Array(7).fill({ fichier: { id: 'f1', type: 'formulaire' }, nom: 'Inscription (1)' }));
  assert.deepEqual([60, 61, 62, 63, 64, 65, 66].map(id => replyTo(fake, id).data), [
    { id: 12 }, { id: 'abc', nom: 'Inscription (2)', dit: 'Copie fermée.' }, { dit: 'Rien à copier.' }, {}, {}, { dit: 'x' }, {},
  ], '`nom` ne part qu\'avec un `id`, un `id` vide ou qui n\'est ni texte ni nombre n\'est pas une copie');
});

test('`supprimer` et `dupliquer` : des arguments mal formés arrivent normalisés, une erreur part avec son texte, un appel sans `id` n\'a pas de réponse', async () => {
  const { fake, link } = await hosted();
  const seen = [];
  let fail = false;
  link.onDelete((request) => { seen.push(request); if (fail) throw new Error('Lien impossible à fermer'); return true; });
  link.onDuplicate((request) => { seen.push(request); if (fail) throw new Error('Copie refusée'); return { id: 1 }; });
  fileCall(fake, 70, 'supprimer', null);
  fileCall(fake, 71, 'supprimer', { fichier: { id: [1], type: 42 }, raison: 'x'.repeat(100) });
  fileCall(fake, 72, 'dupliquer', { fichier: 'f', nom: 'n'.repeat(500) });
  await tick();
  assert.deepEqual(seen, [
    { fichier: { id: null, type: '' }, raison: '' },
    { fichier: { id: null, type: '' }, raison: 'x'.repeat(40) },
    { fichier: { id: null, type: '' }, nom: 'n'.repeat(200) },
  ]);
  fail = true;
  const warnings = await quietly(async () => { fileCall(fake, 73, 'supprimer', { fichier: { id: 1, type: 't' } }); fileCall(fake, 74, 'dupliquer', { fichier: { id: 1, type: 't' }, nom: 'a' }); await tick(); });
  assert.deepEqual(replyTo(fake, 73), { gfs: 0, id: 73, type: 'erreur', message: 'Lien impossible à fermer' });
  assert.deepEqual(replyTo(fake, 74), { gfs: 0, id: 74, type: 'erreur', message: 'Copie refusée' });
  assert.match(warnings.join('\n'), /mise à la corbeille demandée par GFS en échec/);
  assert.match(warnings.join('\n'), /copie demandée par GFS en échec/);
  const before = fake.sent.length;
  fileCall(fake, undefined, 'supprimer', { fichier: { id: 1, type: 't' } });
  await tick();
  assert.equal(fake.sent.length, before, 'un appel sans `id` n\'attend pas de réponse');
});

test('`supprimer` et `dupliquer` sans abonné reçoivent `GFS_INCONNU` ; se désabonner y revient, un abonné remplacé ne retire pas le nouveau, un autre cadre n\'appelle personne', async () => {
  const { fake, link } = await hosted();
  for (const [id, nom] of [[80, 'supprimer'], [81, 'dupliquer']]) {
    fileCall(fake, id, nom, { fichier: { id: 1, type: 't' }, nom: 'a' });
    assert.deepEqual([replyTo(fake, id).type, replyTo(fake, id).code], ['erreur', 'GFS_INCONNU'], `${nom} sans abonné`);
  }
  const offDelete = link.onDelete(() => true);
  const offCopy = link.onDuplicate(() => ({ id: 2 }));
  fileCall(fake, 82, 'supprimer', { fichier: { id: 1, type: 't' } });
  fileCall(fake, 83, 'dupliquer', { fichier: { id: 1, type: 't' }, nom: 'a' });
  await tick();
  assert.deepEqual([replyTo(fake, 82).data, replyTo(fake, 83).data], [{ fait: true }, { id: 2 }]);
  offDelete();
  offCopy();
  fileCall(fake, 84, 'supprimer', { fichier: { id: 1, type: 't' } });
  fileCall(fake, 85, 'dupliquer', { fichier: { id: 1, type: 't' }, nom: 'a' });
  assert.deepEqual([replyTo(fake, 84).code, replyTo(fake, 85).code], ['GFS_INCONNU', 'GFS_INCONNU']);
  const second = link.onDelete(() => false);
  const first = link.onDelete(() => true);
  second();
  fileCall(fake, 86, 'supprimer', { fichier: { id: 1, type: 't' } });
  await tick();
  assert.equal(replyTo(fake, 86).data.fait, true, 'se désabonner d\'un abonné remplacé ne retire pas le nouveau');
  first();
  let called = 0;
  link.onDelete(() => { called++; return true; });
  link.onDuplicate(() => { called++; return { id: 3 }; });
  const before = fake.sent.length;
  fake.deliver({ gfs: 0, type: 'appel', id: 87, nom: 'supprimer', args: { fichier: { id: 1, type: 't' } } }, { postMessage() {} });
  fake.deliver({ gfs: 0, type: 'appel', id: 88, nom: 'dupliquer', args: { fichier: { id: 1, type: 't' }, nom: 'a' } }, { postMessage() {} });
  await tick();
  assert.equal(called, 0);
  assert.equal(fake.sent.length, before);
});
