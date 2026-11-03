// Le lien avec GFS (js/gfs-link.js) dans un vrai navigateur : le cadre de l'app isolé comme chez GFS (sandbox="allow-scripts", sans allow-same-origin : origine opaque, aucun
// stockage à lui), sous la politique d'une app hébergée, face à une page qui joue GFS (navigateur/gfs-hote.html). Ce que GFS envoie vraiment se mesure dans le labo de GFS, avec l'app.
import { check } from './aide.mjs';

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
  await context.close();
}
