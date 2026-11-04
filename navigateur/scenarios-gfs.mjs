// Le lien avec GFS (js/gfs-link.js) dans un vrai navigateur : le cadre de l'app isolé comme chez GFS (sandbox="allow-scripts", sans allow-same-origin : origine opaque, aucun
// stockage à lui), sous la politique d'une app hébergée, face à une page qui joue GFS (navigateur/gfs-hote.html). Ce que GFS envoie vraiment se mesure dans le labo de GFS, avec l'app.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { check, ROOT } from './aide.mjs';

const fromApp = async (page, test) => (await page.evaluate(() => window.hote.received())).filter(entry => entry.from === 'app' && test(entry.data)).map(entry => entry.data);

async function until(probe, timeout = 3000) {
  const end = Date.now() + timeout;
  let value = await probe();
  while (!value && Date.now() < end) { await new Promise(resolve => setTimeout(resolve, 50)); value = await probe(); }
  return value;
}

async function openHost(env) {
  const context = await env.browser.newContext({ viewport: { width: 700, height: 400 } });
  const page = await context.newPage();
  page.on('pageerror', error => env.problems.push(`erreur de page : ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') env.problems.push(`console : ${message.text()}`); });
  page.on('request', request => { if (!request.url().startsWith(env.origin)) env.external.push(request.url()); });
  await page.goto(`${env.origin}/navigateur/gfs-hote.html`);
  const frameOf = re => until(async () => page.frames().find(frame => re.test(frame.url())) || null);
  const app = await frameOf(/gfs-cadre\.html/);
  const neighbour = await frameOf(/gfs-voisin\.html/);
  await app.waitForFunction(() => window.cadre && window.cadre.GfsLink.isAnswering(), null, { timeout: 5000 });
  return { context, page, app, neighbour };
}

export async function gfsLink(env) {
  const { context, page, app, neighbour } = await openHost(env);
  const state = () => app.evaluate(() => {
    const { GfsLink, seen, origin, ownStorage } = window.cadre;
    return { hosted: GfsLink.hosted, origin, ownStorage, language: GfsLink.language(), bar: GfsLink.bar(), theme: GfsLink.storageGet('kit_theme'), document: (GfsLink.context() || {}).document, seen };
  });
  let now = await state();
  check('le cadre de l\'app est isolé comme chez GFS : origine opaque, aucun stockage à lui, et il se sait hébergé', now.origin === 'null' && now.ownStorage === 'refusé' && now.hosted === true, now);
  const asked = await fromApp(page, data => data && data.type === 'appel' && data.nom === 'contexte');
  // L'abonné de la langue, inscrit avant l'arrivée du contexte, en a été rappelé une fois (« en »).
  check('le contexte est demandé une fois, par le cadre de l\'app ; sa réponse est lue (langue, barre, choix gardés, document), l\'abonné de la langue rappelé une fois',
    asked.length === 1 && now.language === 'en' && JSON.stringify(now.seen.langue) === '["en"]' && now.bar && now.bar.bord === 'gauche' && now.theme === 'dark' && now.document === 'essai', { asked, now });

  const set = await app.evaluate(() => window.cadre.GfsLink.storageSet('kit_theme', 'light'));
  const writes = await until(() => fromApp(page, data => data && data.nom === 'stockage.ecrire').then(found => (found.length ? found : null)));
  check('un choix gardé change la copie de l\'app et part chez GFS par « stockage.ecrire », sans id', set === true && writes && writes.length === 1 && !('id' in writes[0])
    && JSON.stringify(writes[0].args) === JSON.stringify({ cle: 'kit_theme', valeur: 'light' }) && (await state()).theme === 'light', writes);

  await neighbour.evaluate(() => window.parent[0].postMessage({ gfs: 0, type: 'evenement', nom: 'langue', data: { langue: 'fr' } }, '*'));
  await page.waitForTimeout(300);
  now = await state();
  check('un cadre voisin qui écrit à l\'app avec l\'enveloppe de GFS n\'est pas lu', now.language === 'en' && JSON.stringify(now.seen.langue) === '["en"]', now);

  await page.evaluate(() => window.hote.send({ gfs: 0, type: 'evenement', nom: 'langue', data: { langue: 'fr' } }));
  now = await until(async () => { const value = await state(); return value.seen.langue.length > 1 ? value : null; });
  check('l\'événement « langue » de GFS est suivi, une fois', Boolean(now) && now.language === 'fr' && JSON.stringify(now.seen.langue) === '["en","fr"]', now);

  await page.evaluate(() => window.hote.send({ gfs: 0, type: 'appel', id: 41, nom: 'ouvrir', args: { fichier: { id: 16, type: 'formulaire' }, type: 'formulaire', dossier: '', raison: 'explorateur' } }));
  const replies = await until(() => fromApp(page, data => data && data.id === 41).then(found => (found.length ? found : null)));
  now = await state();
  check('« ouvrir » arrive à l\'app (l\'identifiant du fichier en texte) et la réponse reprend son id',
    JSON.stringify(replies) === JSON.stringify([{ gfs: 0, id: 41, type: 'reponse', data: { ouvert: true } }]) && now.seen.ouvrir.length === 1 && now.seen.ouvrir[0].fichier.id === '16', { replies, seen: now.seen });

  // `fermer` (5.4 point 3) : sans abonné l'app part comme avant (`GFS_INCONNU`) ; avec `onClose`, la réponse reprend l'id et seul vrai laisse partir l'app.
  await page.evaluate(() => window.hote.send({ gfs: 0, type: 'appel', id: 42, nom: 'fermer', args: { raison: 'explorateur' } }));
  const unknown = await until(() => fromApp(page, data => data && data.id === 42).then(found => (found.length ? found : null)));
  check('« fermer » sans abonné reçoit `GFS_INCONNU`, avec son id', Boolean(unknown) && unknown.length === 1 && unknown[0].type === 'erreur' && unknown[0].code === 'GFS_INCONNU', unknown);
  await app.evaluate(() => { window.cadre.closing = []; window.cadre.GfsLink.onClose((request) => { window.cadre.closing.push(request); return request.raison !== 'app'; }); });
  await page.evaluate(() => { window.hote.send({ gfs: 0, type: 'appel', id: 43, nom: 'fermer', args: { raison: 'explorateur' } }); window.hote.send({ gfs: 0, type: 'appel', id: 44, nom: 'fermer', args: { raison: 'app' } }); });
  const closed = await until(() => fromApp(page, data => data && (data.id === 43 || data.id === 44)).then(found => (found.length >= 2 ? found : null)));
  const received = await app.evaluate(() => window.cadre.closing);
  check('« fermer » avec `onClose` : l\'app reçoit la raison, vrai la laisse partir, faux la garde, chaque réponse reprend son id',
    JSON.stringify(received) === '[{"raison":"explorateur"},{"raison":"app"}]' && Boolean(closed)
    && JSON.stringify(closed.map(reply => [reply.id, reply.type, reply.data && reply.data.ferme])) === '[[43,"reponse",true],[44,"reponse",false]]', { received, closed });

  // Les liens entre apps (5.4) : la demande part dans la forme du contrat, la clé rendue par GFS est lue, l'annulation rend null, un refus de GFS garde son code.
  const calls = name => fromApp(page, data => data && data.type === 'appel' && data.nom === name);
  const later = async (name, count) => until(() => calls(name).then(found => (found.length >= count ? found : null)));
  const answer = (id, message) => page.evaluate(([askId, body]) => window.hote.send({ gfs: 0, id: askId, ...body }), [id, message]);
  await app.evaluate(() => { window.cadre.link = window.cadre.GfsLink.choose({ types: ['document', 'document', 'grille'], titre: 'Lier un contrat' }); });
  const asks = await later('choisir', 1);
  await answer(asks[0].id, { type: 'reponse', data: { app: 'publipostage', id: 12, nom: 'Contrat Martin', type: 'document' } });
  const chosen = await app.evaluate(() => window.cadre.link);
  check('« choisir » part avec les types sans doublon et le titre ; la clé rendue par GFS est lue (identifiant en texte, nom)',
    asks.length === 1 && JSON.stringify(asks[0].args) === JSON.stringify({ types: ['document', 'grille'], titre: 'Lier un contrat' })
    && JSON.stringify(chosen) === JSON.stringify({ app: 'publipostage', id: '12', nom: 'Contrat Martin', type: 'document' }), { asks, chosen });

  await app.evaluate(() => { window.cadre.link = window.cadre.GfsLink.choose({ types: ['grille'] }); });
  const second = await later('choisir', 2);
  await answer(second[1].id, { type: 'reponse', data: null });
  check('une personne qui annule rend null à l\'app', (await app.evaluate(() => window.cadre.link)) === null, second);

  await app.evaluate(() => { window.cadre.link = window.cadre.GfsLink.openFile({ app: 'publipostage', id: 12, type: 'document' }).then(() => 'ouvert', error => error.code); });
  const opens = await later('ouvrir', 1);
  await answer(opens[0].id, { type: 'erreur', code: 'GFS_INTROUVABLE', message: 'Le fichier n\'est plus là.' });
  const refused = await app.evaluate(() => window.cadre.link);
  check('« ouvrir » part avec { app, fichier: { id (texte), type } } ; un fichier disparu rejette avec son code, jamais avec le lien lui-même',
    opens.length === 1 && JSON.stringify(opens[0].args) === JSON.stringify({ app: 'publipostage', fichier: { id: '12', type: 'document' } }) && refused === 'GFS_INTROUVABLE', { opens, refused });
  await files(page, app);
  await ambiance(page, app);
  await context.close();
}

// Les fichiers qui passent entre l'app et GFS (5.2 point 3 et 5.4 points 1, 8 et 9), dans un cadre isolé qui n'a ni stockage ni origine : le `File` que GFS passe à l'ouverture (`importation`, `lecture`) arrive
// vrai `File`, avec son nom et ses octets, et celui que l'app fabrique pour `GfsLink.deposit` part avec les siens ; la réponse de GFS est lue, un refus garde son code.
async function files(page, app) {
  const calls = name => fromApp(page, data => data && data.type === 'appel' && data.nom === name);
  const later = (name, count) => until(() => calls(name).then(found => (found.length >= count ? found : null)));
  const answer = (id, message) => page.evaluate(([askId, body]) => window.hote.send({ gfs: 0, id: askId, ...body }), [id, message]);
  const lastOpening = () => app.evaluate(async () => {
    const request = window.cadre.seen.ouvrir.at(-1);
    const describe = async entry => (entry ? { cles: Object.keys(entry).sort(), vrai: entry.fichier instanceof File, nom: entry.fichier.name, taille: entry.fichier.size, type: entry.fichier.type, debut: (await entry.fichier.text()).slice(0, 12), id: entry.id, valeur: entry.valeur } : null);
    return { cles: Object.keys(request).sort(), raison: request.raison, lecture: await describe(request.lecture), importation: await describe(request.importation) };
  });

  await page.evaluate(() => {
    const pdf = new File(['%PDF-1.4 kit'], 'Facture.pdf', { type: 'application/pdf' });
    window.hote.send({ gfs: 0, type: 'appel', id: 52, nom: 'ouvrir', args: { fichier: null, type: 'pdf', dossier: 'Factures', raison: 'lire', lecture: { id: 12, fichier: pdf } } });
  });
  let opening = await until(async () => { const value = await lastOpening().catch(() => null); return value && value.raison === 'lire' ? value : null; });
  check('« ouvrir » avec `lecture` : l\'app reçoit un vrai File (nom, taille, type, octets) et l\'identifiant du fichier en texte, sans `importation`',
    Boolean(opening) && opening.cles.join() === 'dossier,fichier,lecture,raison,type' && opening.importation === null
    && JSON.stringify(opening.lecture) === JSON.stringify({ cles: ['fichier', 'id'], vrai: true, nom: 'Facture.pdf', taille: 12, type: 'application/pdf', debut: '%PDF-1.4 kit', id: '12' }), opening);

  await page.evaluate(() => {
    const docx = new File(['PK\u0003\u0004 kit'], 'modele.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    window.hote.send({ gfs: 0, type: 'appel', id: 53, nom: 'ouvrir', args: { fichier: null, type: 'document', dossier: '', raison: 'importer', importation: { valeur: 'docx', fichier: docx } } });
  });
  opening = await until(async () => { const value = await lastOpening().catch(() => null); return value && value.raison === 'importer' ? value : null; });
  check('« ouvrir » avec `importation` : l\'app reçoit la valeur du format et un vrai File, sans `lecture`',
    Boolean(opening) && opening.cles.join() === 'dossier,fichier,importation,raison,type' && opening.lecture === null && opening.importation.vrai === true
    && opening.importation.valeur === 'docx' && opening.importation.nom === 'modele.docx' && opening.importation.taille === 8, opening);

  await app.evaluate(() => {
    const file = new File(['%PDF-1.4 export'], 'Facture.pdf', { type: 'application/pdf' });
    window.cadre.link = window.cadre.GfsLink.deposit({ fichier: file, nom: 'Facture', lot: 'export-3', suivants: 2, dossier: 'Factures' });
  });
  const deposits = await later('ranger', 1);
  await answer(deposits[0].id, { type: 'reponse', data: { statut: 'copie', id: 'f7', nom: 'Facture (1).pdf', inconnu: 'pas gardé' } });
  const stored = await app.evaluate(() => window.cadre.link);
  check('« ranger » part avec le File fabriqué dans le cadre isolé (nom, type, octets), le nom, le lot, ce qui reste et le dossier ; la réponse de GFS est lue : { statut, id, nom }',
    deposits.length === 1 && JSON.stringify(deposits[0].args) === JSON.stringify({ fichier: { blob: true, fichier: true, nom: 'Facture.pdf', taille: 15, type: 'application/pdf', debut: '%PDF-1.4 exp' }, nom: 'Facture', lot: 'export-3', suivants: 2, dossier: 'Factures' })
    && JSON.stringify(stored) === JSON.stringify({ statut: 'copie', id: 'f7', nom: 'Facture (1).pdf' }), { deposits, stored });

  await app.evaluate(() => {
    window.cadre.link = window.cadre.GfsLink.deposit({ fichier: new File(['%PDF-1.4'], 'B.pdf'), nom: 'B.pdf' }).then(() => 'rangé', error => `${error.code} : ${error.message}`);
  });
  const second = await later('ranger', 2);
  await answer(second[1].id, { type: 'erreur', code: 'GFS_ANNULE', message: 'Tu as refusé de créer la table des fichiers.' });
  const refused = await app.evaluate(() => window.cadre.link);
  check('un refus de GFS garde son code et sa phrase ; sans lot ni dossier, rien de plus ne part', refused === 'GFS_ANNULE : Tu as refusé de créer la table des fichiers.'
    && JSON.stringify(Object.keys(second[1].args).sort()) === JSON.stringify(['fichier', 'nom']), { refused, second });
}

// L'ambiance de GFS (5.2, point 10) : GFS la donne par l'événement `ambiance` (ici un vrai message, test/ambiance-exemple.json) ; l'app la pose par le CSSOM, la politique `style-src 'self'` de sa page ne laissant
// passer aucun attribut `style` écrit d'après un message ; elle suit son mode (le thème de l'app) et retire tout sur `null`.
async function ambiance(page, app) {
  const sample = JSON.parse(await readFile(join(ROOT, 'test', 'ambiance-exemple.json'), 'utf8'));
  const look = () => app.evaluate(() => {
    const root = document.documentElement;
    const css = getComputedStyle(root);
    return { accent: css.getPropertyValue('--accent').trim(), radius: css.getPropertyValue('--radius-md').trim(), inline: [...root.style].filter(name => name.startsWith('--')).length, seen: window.cadre.seen.ambiance.slice() };
  });
  const send = data => page.evaluate(message => window.hote.send({ gfs: 0, type: 'evenement', nom: 'ambiance', data: { ambiance: message } }), data);
  let now = await look();
  check('avant tout message d\'ambiance, l\'app n\'a posé aucun jeton', now.inline === 0 && now.accent === '' && now.seen.length === 0, now);
  await send(sample);
  now = await until(async () => { const value = await look(); return value.inline > 0 ? value : null; });
  check('l\'événement « ambiance » est posé sur la page par le CSSOM : les dix-neuf jetons de couleur du mode clair et les jetons de forme (sans erreur de politique de sécurité)',
    Boolean(now) && now.accent === sample.clair['--accent'] && now.radius === sample.forme['--radius-md'] && now.inline === 19 + Object.keys(sample.forme).length && JSON.stringify(now.seen) === '["pop"]', now);
  await app.evaluate(() => window.cadre.Theme.set('dark'));
  now = await until(async () => { const value = await look(); return value.accent === sample.sombre['--accent'] ? value : null; });
  check('le mode de l\'app change (son thème) : les jetons suivent sans que GFS dise rien, la forme reste, rien de plus n\'est posé', Boolean(now) && now.radius === sample.forme['--radius-md'] && now.inline === 19 + Object.keys(sample.forme).length && now.seen.length === 1, now);
  await app.evaluate(() => window.cadre.Theme.set('light'));
  now = await until(async () => { const value = await look(); return value.accent === sample.clair['--accent'] ? value : null; });
  check('et revient en clair', Boolean(now), now);
  await send(null);
  now = await until(async () => { const value = await look(); return value.inline === 0 ? value : null; });
  check('`null` retire tout ce que l\'app avait posé : le retour à ses couleurs', Boolean(now) && now.accent === '' && JSON.stringify(now.seen) === '["pop",null]', now);
  await send({ ...sample, clair: { ...sample.clair, '--accent': 'red' }, forme: { ...sample.forme, '--radius-md': '1px; background: red', '--wash': 'url(https://example.com/x.png)' } });
  now = await until(async () => { const value = await look(); return value.inline > 0 ? value : null; });
  check('une couleur qui n\'en est pas une et une valeur de forme qui sort de sa déclaration ne sont pas posées, le reste l\'est', Boolean(now) && now.accent === '' && now.radius === '' && now.inline === 19 + Object.keys(sample.forme).length - 3, now);
}
