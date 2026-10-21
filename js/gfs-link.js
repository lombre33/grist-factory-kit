// Le lien avec Grist Factory Suite (GFS), le widget qui héberge les apps : ce que l'app sait de GFS quand il l'héberge, et ses replis quand elle tourne seule (une section de Grist
// qui charge l'adresse de son dépôt). Extrait de Publipostage+ (`js/gfs-link.js` à 487d66b), avec la barre de GFS et le repli du stockage en plus. Les messages ont l'enveloppe des
// contrats de GFS (section 5) : { gfs: <contrat>, type: 'appel' | 'reponse' | 'erreur' | 'evenement', id, nom, args | data }, postés au cadre parent avec `targetOrigin '*'` (le cadre
// d'une app dans GFS a une origine opaque), sans le `mtype` du protocole des widgets : le script d'API de Grist les ignore.
//   await GfsLink.ready;                         // le contexte est arrivé, ou ses 5 secondes sont passées : jamais rejetée, tout de suite quand l'app est seule
//   GfsLink.hosted                               // GFS héberge l'app : `gfs=<n>` dans l'adresse de son cadre (js/host.js), sans rien demander
//   GfsLink.context()                            // ce que le contexte dit une fois pour toutes (instance, document, page, adresseWidget, acces, lectureSeule…, contrats 5.2), ou null
//   GfsLink.opening()                            // ce que GFS demande d'ouvrir au démarrage, ou null ; GfsLink.onOpen(fn) répond à l'appel `ouvrir` quand l'app est déjà ouverte
//   GfsLink.language(), GfsLink.onLanguage(fn)   // 'fr' ou 'en' : la langue de GFS qui vaut (un seul choix pour GFS et ses apps, 5.2 point 6)
//   GfsLink.bar(), GfsLink.onBar(fn)             // { bord, epaisseur, zone } : ce que la barre de GFS recouvre et que l'app laisse libre, ou null (5.2 point 7)
//   GfsLink.hideBar(true | false)                // l'app demande à ne pas avoir la barre (un diaporama plein cadre), puis la rend
//   GfsLink.storageGet(clé), GfsLink.storageSet(clé, texte | null)   // les choix de la personne : chez GFS (le cadre n'a pas de stockage à lui, 5.3), dans le navigateur seule
//   GfsLink.extensions(), GfsLink.library(id), GfsLink.onExtensions(fn), GfsLink.install(id)   // les extensions actives, la source de leurs bibliothèques (5.2 point 4, 5.4)
// Chaque abonné (`on…`) est rappelé quand la valeur change, l'arrivée du contexte comprise, et chaque `on…` rend de quoi se désabonner. Seule, l'app n'écoute ni n'envoie rien : le
// contexte, l'ouverture, la langue et la barre sont null, les extensions vides. Un message n'est lu que s'il vient du cadre parent (`event.source`) et porte le contrat de GFS ;
// l'écoute passe par addEventListener, jamais par `window.onmessage =`, qui remplacerait celle du script d'API de Grist.
import { once } from './once.js';
import { hostContract } from './host.js';

once('gfs-link', import.meta.url);

const CONTRACT = 0;                              // le contrat que parle l'app, celui de son manifeste (contrats 5.1, point 1)
const CONTEXT_TIMEOUT_MS = 5000;                 // 5.1, point 4 : l'app attend `contexte` 5 secondes au plus
const ID = /^[a-z][a-z0-9_-]{0,63}$/;            // un identifiant d'extension ou de bibliothèque
const STORAGE_KEY = /^[A-Za-z0-9_.:-]{1,64}$/;   // 5.3, point 2 : la forme d'une clé, la même seule et dans GFS
const EDGES = ['gauche', 'haut', 'droite', 'bas'];
// Les champs du contexte qui ne changent pas tant que le cadre vit ; la langue, la barre, les extensions, l'ouverture et le stockage ont chacun leur lecture.
const FIXED = ['contrat', 'hote', 'instance', 'document', 'page', 'section', 'adresseWidget', 'culture', 'fuseau', 'devise', 'lectureSeule', 'acces'];

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = value => (typeof value === 'string' ? value : '');
const copy = value => (value == null ? null : structuredClone(value));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const validKey = key => typeof key === 'string' && STORAGE_KEY.test(key);

// `ouverture` du contexte (contrats 5.2, point 3) ou `args` de l'appel `ouvrir` (5.4) : { fichier, type, dossier, raison }, où `fichier` est null (« Nouveau ») ou { id, type }, l'`id` pris
// comme texte. null quand ce n'est pas un objet.
function normalizeOpening(raw) {
  if (!isObject(raw)) return null;
  const file = isObject(raw.fichier) && raw.fichier.id != null && String(raw.fichier.id).trim() !== '' ? raw.fichier : null;
  return { fichier: file ? { id: String(file.id).trim(), type: text(file.type) } : null, type: text(raw.type), dossier: text(raw.dossier), raison: text(raw.raison) };
}

// `barre` du contexte ou de l'événement (5.2, point 7) : { bord, epaisseur, zone: { x, y, largeur, hauteur } }, en pixels du cadre de l'app, origine en haut à gauche ; null quand rien ne
// recouvre le cadre. Une forme inconnue vaut null : l'app n'écarte rien plutôt que d'écarter n'importe quoi.
function normalizeBar(raw) {
  if (!isObject(raw) || !EDGES.includes(raw.bord) || !isObject(raw.zone)) return null;
  const size = value => (Number.isFinite(value) && value >= 0 ? value : null);
  const zone = { x: size(raw.zone.x), y: size(raw.zone.y), largeur: size(raw.zone.largeur), hauteur: size(raw.zone.hauteur) };
  const depth = size(raw.epaisseur);
  return depth === null || Object.values(zone).includes(null) ? null : { bord: raw.bord, epaisseur: depth, zone };
}

// `stockage` du contexte (5.3, point 1) : l'espace de cette app chez GFS, une Map clé -> texte. Une clé hors de la règle ou une valeur qui n'est pas un texte n'est pas gardée ; null quand ce
// n'est pas un objet (un GFS d'avant le 21/10 n'en donne pas : les choix ne se gardent alors pas).
function normalizeStorage(raw) {
  return isObject(raw) ? new Map(Object.entries(raw).filter(([key, value]) => validKey(key) && typeof value === 'string')) : null;
}

// `extensions` et `bibliotheques` (5.2, point 4) : des identifiants, et pour chaque bibliothèque { src, integrite, forme } (`forme` manque chez un GFS d'avant le 16/10 : un script classique).
function normalizeExtensions(raw) {
  return (Array.isArray(raw) ? raw : []).filter(id => typeof id === 'string' && ID.test(id));
}
function normalizeLibraries(raw) {
  const found = new Map();
  for (const [id, lib] of Object.entries(isObject(raw) ? raw : {})) {
    if (ID.test(id) && isObject(lib) && typeof lib.src === 'string' && typeof lib.integrite === 'string') found.set(id, { src: lib.src, integrite: lib.integrite, forme: lib.forme === 'module' ? 'module' : 'script' });
  }
  return found;
}

// Chaque abonné reçoit sa propre copie de la valeur ; un abonné qui échoue n'empêche pas les suivants.
function notify(listeners, value) {
  for (const listener of [...listeners]) {
    try { listener(value()); } catch (error) { console.warn('[GfsLink] abonné en échec', error); }
  }
}
function subscribe(listeners, fn) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function setLanguage(link, next) {
  if ((next !== 'fr' && next !== 'en') || next === link.language) return;
  link.language = next;
  notify(link.listeners.language, () => next);
}
function setBar(link, raw) {
  const next = normalizeBar(raw);
  if (same(next, link.bar)) return;
  link.bar = next;
  notify(link.listeners.bar, () => copy(next));
}
function setExtensions(link, data) {
  const extensions = normalizeExtensions(data.extensions);
  const libraries = normalizeLibraries(data.bibliotheques);
  if (same([extensions, [...libraries]], [link.extensions, [...link.libraries]])) return;
  link.extensions = extensions;
  link.libraries = libraries;
  notify(link.listeners.extensions, () => extensions.slice());
}

// Le contexte (5.2) : ses champs fixes, l'ouverture (GFS ne la rend qu'une fois, au premier contexte de l'app qu'il vient d'activer), l'espace de l'app, puis ce qui change ensuite par les
// événements. Rien d'autre n'est gardé.
function applyContext(link, data) {
  if (!isObject(data)) return;
  link.context = Object.fromEntries(FIXED.filter(name => name in data).map(name => [name, data[name]]));
  link.opening = normalizeOpening(data.ouverture);
  link.storage = normalizeStorage(data.stockage);
  link.known = true;
  setLanguage(link, data.langue);
  setBar(link, data.barre);
  setExtensions(link, data);
}

// Les trois événements de GFS (5.2, point 2), chacun avec son corps ; un autre est ignoré (5.1, point 3).
const EVENTS = { langue: (link, data) => setLanguage(link, data.langue), barre: (link, data) => setBar(link, data.barre), extensions: setExtensions };
function applyEvent(link, name, data) {
  if (!isObject(data) || !Object.hasOwn(EVENTS, name)) return;
  link.known = true;
  EVENTS[name](link, data);
}

// Poste au cadre parent (GFS) un message de l'enveloppe, au contrat de l'app. Faux quand le cadre parent n'est plus là.
function post(link, fields) {
  try {
    link.host.parent.postMessage({ gfs: CONTRACT, ...fields }, '*');
    return true;
  } catch (error) { return false; }
}

// Un appel de l'app à GFS, qui attend sa réponse : `timeoutMs` pour le contexte, aucun délai pour ce qui attend une personne (`installer`). Une erreur de GFS rejette avec son `code`.
function call(link, name, args, timeoutMs) {
  return new Promise((resolve, reject) => {
    const id = link.nextId++;
    let timer = 0;
    const settle = fn => value => { clearTimeout(timer); link.pending.delete(id); fn(value); };
    link.pending.set(id, { resolve: settle(resolve), reject: settle(reject) });
    if (timeoutMs) timer = setTimeout(() => settle(reject)(new Error(`GFS ne répond pas : ${name}`)), timeoutMs);
    if (!post(link, { type: 'appel', id, nom: name, ...(args === undefined ? {} : { args }) })) settle(reject)(new Error('GFS absent'));
  });
}

// Une réponse que personne n'attend (un id inconnu, déjà répondu, ou arrivé après le délai) est ignorée.
function answered(link, message) {
  const entry = link.pending.get(message.id);
  if (!entry) return;
  if (message.type === 'reponse') entry.resolve(message.data);
  else entry.reject(Object.assign(new Error(String(message.message || message.code || 'erreur de GFS')), { code: typeof message.code === 'string' ? message.code : 'GFS_ERREUR' }));
}

// Donne l'appel `ouvrir` à l'abonné et rend sa réponse à GFS (5.4, point 1) : `{ ouvert: true }` quand il rend vrai, `{ ouvert: false }` sinon (la personne a annulé, ou l'app a dit
// elle-même pourquoi : GFS n'ajoute rien) ; une erreur qu'il lève part avec son texte, que GFS dit à la personne. Sans `id`, l'appel n'attend pas de réponse (5.1, point 2).
function deliverOpen(link, request) {
  const reply = fields => { if (request.id !== null) post(link, { id: request.id, ...fields }); };
  let result;
  try { result = Promise.resolve(link.openHandler(request.args)); } catch (error) { result = Promise.reject(error); }
  result.then(opened => reply({ type: 'reponse', data: { ouvert: opened === true } }), (error) => {
    console.warn('[GfsLink] ouverture demandée par GFS en échec', error);
    reply({ type: 'erreur', message: String((error && error.message) || error || '').slice(0, 200) });
  });
}

// Un appel de GFS vers l'app : `ouvrir` va à celui qui s'est inscrit (onOpen), dans l'ordre d'arrivée, même avant son inscription ; tout autre nom reçoit `GFS_INCONNU` (5.1, point 3).
function receiveCall(link, message) {
  const id = Number.isInteger(message.id) ? message.id : null;
  if (message.nom !== 'ouvrir') {
    if (id !== null) post(link, { type: 'erreur', id, code: 'GFS_INCONNU', message: `Appel inconnu : ${String(message.nom).slice(0, 60)}` });
    return;
  }
  const request = { id, args: normalizeOpening(message.args) };
  if (link.openHandler) deliverOpen(link, request); else link.earlyOpens.push(request);
}

function receive(link, event) {
  const message = event.data;
  if (event.source !== link.host.parent || !isObject(message) || message.gfs !== link.contract) return;
  if (message.type === 'reponse' || message.type === 'erreur') answered(link, message);
  else if (message.type === 'evenement') applyEvent(link, message.nom, message.data);
  else if (message.type === 'appel') receiveCall(link, message);
}

// Seule, l'app garde les choix de la personne dans le navigateur, qui peut le refuser (navigation privée) : la lecture rend null, l'écriture false, rien ne s'arrête.
function readBrowser(host, key) {
  try { return host.localStorage.getItem(key); } catch (error) { return null; }
}
function writeBrowser(host, key, value) {
  try {
    if (value === null) host.localStorage.removeItem(key); else host.localStorage.setItem(key, value);
    return true;
  } catch (error) { return false; }
}

// Dans GFS (5.3) : la copie de l'espace de l'app que le contexte a rendue, lue tout de suite ; l'écriture change la copie et part par `stockage.ecrire` sans `id`, donc sans réponse (un refus,
// `GFS_QUOTA` ou `GFS_REFUSE`, se lit dans la console de GFS). `valeur` null retire la clé. Faux sans rien envoyer quand GFS n'a pas rendu d'espace, ou que la clé ou la valeur est hors règle.
function storageGet(link, key) {
  if (!link.hosted) return validKey(key) ? readBrowser(link.host, key) : null;
  return link.storage && link.storage.has(key) ? link.storage.get(key) : null;
}
function storageSet(link, key, value) {
  if (!validKey(key) || (value !== null && typeof value !== 'string')) return false;
  if (!link.hosted) return writeBrowser(link.host, key, value);
  if (link.storage === null) return false;
  if (value === null) link.storage.delete(key); else link.storage.set(key, value);
  return post(link, { type: 'appel', nom: 'stockage.ecrire', args: { cle: key, valeur: value } });
}

// `barre.masquer` (5.2, point 7), sans `id` : l'événement `barre` dit ensuite ce qui vaut. La demande ne tient que tant que l'app est montrée ; l'app qui masque la barre offre elle-même
// la sortie (Échap). Faux seule, ou pour une valeur qui n'est ni vraie ni fausse.
function hideBar(link, hidden) {
  if (!link.hosted || typeof hidden !== 'boolean') return false;
  return post(link, { type: 'appel', nom: 'barre.masquer', args: { masquee: hidden } });
}

// Ouvre, dans GFS, la fenêtre d'installation à la ligne de l'extension (un clic sur une fonction grisée, 5.4 point 4). Rend les extensions actives après le choix de la personne ; l'événement
// `extensions` suit si elle en a activé une. Deux clics pendant que la fenêtre est ouverte ne posent qu'une demande.
function install(link, extension) {
  if (!link.hosted) return Promise.reject(new Error('GFS absent'));
  if (!link.installing.has(extension)) {
    const request = call(link, 'installer', { extension }).then(data => normalizeExtensions(isObject(data) ? data.actives : null));
    const settled = () => link.installing.delete(extension);
    link.installing.set(extension, request);
    request.then(settled, settled);
  }
  return link.installing.get(extension);
}

function onOpen(link, fn) {
  link.openHandler = fn;
  for (const request of link.earlyOpens.splice(0)) deliverOpen(link, request);
  return () => { if (link.openHandler === fn) link.openHandler = null; };
}

function newLink(host) {
  const framed = Boolean(host && host.parent) && host.parent !== host;
  const contract = framed ? hostContract(host.location && host.location.search) : null;
  return {
    host, contract, hosted: contract !== null, known: false, nextId: 1,
    context: null, opening: null, language: null, bar: null, storage: null, extensions: [], libraries: new Map(),
    listeners: { language: new Set(), bar: new Set(), extensions: new Set() },
    pending: new Map(), installing: new Map(), openHandler: null, earlyOpens: [],
  };
}

function start(link, timeoutMs) {
  if (!link.hosted) return Promise.resolve();
  link.host.addEventListener('message', event => receive(link, event));
  return call(link, 'contexte', undefined, timeoutMs).then(data => applyContext(link, data), error => console.warn('[GfsLink] contexte indisponible', error)).then(() => undefined);
}

// Un lien par page (GfsLink, plus bas) ; `createGfsLink` en fait un autre pour un essai : `host` tient lieu de fenêtre de l'app (sa `location`, son `parent`, son `addEventListener`, son
// `localStorage`), `timeoutMs` du délai du contexte.
export function createGfsLink({ host = globalThis.window, timeoutMs = CONTEXT_TIMEOUT_MS } = {}) {
  const link = newLink(host);
  const ready = start(link, timeoutMs);
  return Object.freeze({
    hosted: link.hosted,
    ready,
    // GFS a répondu (le contexte ou un événement est arrivé) : faux seule, et tant qu'un GFS qui ne répond pas laisse passer ses 5 secondes.
    isAnswering: () => link.known,
    context: () => copy(link.context),
    opening: () => copy(link.opening),
    language: () => link.language,
    bar: () => copy(link.bar),
    extensions: () => link.extensions.slice(),
    library: id => copy(link.libraries.get(id)),
    storageGet: key => storageGet(link, key),
    storageSet: (key, value) => storageSet(link, key, value),
    hideBar: hidden => hideBar(link, hidden),
    install: extension => install(link, extension),
    // Un lien `mailto:` ou `tel:` suivi dans le cadre isolé de GFS le fait mourir (contrats 1.3, point 1) : hébergée, l'app l'ouvre dans un nouvel onglet. Seule, faux.
    opensInNewTab: href => link.hosted && /^(?:mailto|tel):/i.test(String(href == null ? '' : href).trim()),
    onOpen: fn => onOpen(link, fn),
    onLanguage: fn => subscribe(link.listeners.language, fn),
    onBar: fn => subscribe(link.listeners.bar, fn),
    onExtensions: fn => subscribe(link.listeners.extensions, fn),
  });
}

// Le lien de la page : celui que lisent l'app et ses extensions.
export const GfsLink = createGfsLink();
