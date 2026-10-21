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
