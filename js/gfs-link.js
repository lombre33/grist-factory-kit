// Le lien avec Grist Factory Suite (GFS), le widget qui héberge les apps : ce que l'app sait de GFS quand il l'héberge, et ses replis quand elle tourne seule (une section de Grist
// qui charge l'adresse de son dépôt). Extrait de Publipostage+ (`js/gfs-link.js` à 487d66b), avec la barre de GFS et le repli du stockage en plus. Les messages ont l'enveloppe des
// contrats de GFS (section 5) : { gfs: <contrat>, type: 'appel' | 'reponse' | 'erreur' | 'evenement', id, nom, args | data }, postés au cadre parent avec `targetOrigin '*'` (le cadre
// d'une app dans GFS a une origine opaque), sans le `mtype` du protocole des widgets : le script d'API de Grist les ignore.
//   await GfsLink.ready;                         // le contexte est arrivé, ou ses 5 secondes sont passées : jamais rejetée, tout de suite quand l'app est seule
//   GfsLink.hosted                               // GFS héberge l'app : `gfs=<n>` dans l'adresse de son cadre (js/host.js), sans rien demander
//   GfsLink.context()                            // ce que le contexte dit une fois pour toutes (instance, document, page, adresseWidget, acces, lectureSeule…, contrats 5.2), ou null
//   GfsLink.opening()                            // ce que GFS demande d'ouvrir au démarrage, ou null ; GfsLink.onOpen(fn) répond à l'appel `ouvrir` quand l'app est déjà ouverte (le fichier passé par `importation` ou `lecture`, ci-dessous)
//   GfsLink.language(), GfsLink.onLanguage(fn)   // 'fr' ou 'en' : la langue de GFS qui vaut (un seul choix pour GFS et ses apps, 5.2 point 6)
//   GfsLink.bar(), GfsLink.onBar(fn)             // { bord, epaisseur, zone } : ce que la barre de GFS recouvre et que l'app laisse libre, ou null (5.2 point 7)
//   GfsLink.hideBar(true | false)                // l'app demande à ne pas avoir la barre (un diaporama plein cadre), puis la rend
//   GfsLink.identity(), GfsLink.onIdentity(fn)   // { email } : l'adresse e-mail de la personne, que GFS ne donne qu'à l'app qui l'a déclarée (`permissions.identite`), ou null (5.2 point 9)
//   GfsLink.ambiance(), GfsLink.onAmbiance(fn)   // l'ambiance et la couleur que la personne a choisies pour GFS et ses apps (js/ambiance-message.js), ou null : rien n'est choisi (5.2 point 10) ; js/ambiance.js la pose
//   GfsLink.storageGet(clé), GfsLink.storageSet(clé, texte | null)   // les choix de la personne : chez GFS (le cadre n'a pas de stockage à lui, 5.3), dans le navigateur seule
//   GfsLink.extensions(), GfsLink.library(id), GfsLink.onExtensions(fn), GfsLink.install(id)   // les extensions actives, la source de leurs bibliothèques (5.2 point 4, 5.4)
//   GfsLink.choose({ types, apps?, titre? })     // la personne désigne un fichier d'une autre app dans l'explorateur de GFS : { app, id, nom, type }, ou null si elle annule (5.4, point 2)
//   GfsLink.openFile({ app, id, type })          // GFS ouvre ce fichier dans son app : { ouvert } ; dans une autre app que celle-ci, elle prend la place de celle-ci (5.4, point 7)
//   GfsLink.deposit({ fichier, nom, type?, lot?, suivants?, dossier? })   // GFS garde ce fichier que l'app vient de fabriquer (un export en PDF) : { statut, id, nom } (5.4, point 9)
//   GfsLink.onDelete(fn), GfsLink.onDuplicate(fn)   // GFS met à la corbeille ou copie un fichier de l'app qui tient à plus qu'une ligne (un formulaire : sa section, sa table, son lien) : fn({ fichier, raison | nom }) rend { fait, dit? } | { id, nom?, dit? } (5.4, points 10 et 11)
//   GfsLink.onClose(fn)                          // GFS va remplacer l'app par une autre (fenêtre des apps, fichier d'une autre app, lien) : fn({ raison }) enregistre ce qui attend ou pose sa question (Enregistrer, Abandonner, Annuler), puis rend vrai si l'app peut partir, faux si la personne reste (5.4, point 3)
// `choose` et `openFile` sont les liens entre apps : l'app garde la clé { app, id, type } que `choose` rend (le nom n'est qu'une étiquette) et la rend à `openFile` ; un fichier disparu rejette `openFile`
// avec `GFS_INTROUVABLE`, une personne qui ne débloque pas l'app avec `GFS_ANNULE`, jamais le lien lui-même.
// `deposit` est le rangement d'un export : l'app donne les octets (un `File` ou un `Blob`) et un nom, jamais un jeton ; GFS seul écrit ce qu'il garde, pose lui-même la question « Ce nom est déjà pris »
// à la personne (elle a le choix de remplacer, de garder les deux ou de ne rien ranger) et rend ce qu'il a fait : `statut` vaut `ajoute`, `remplace`, `copie` (le nom était pris : `nom` est le nom libre
// que GFS a donné) ou `ignore` (la personne n'en veut pas : `id` et `nom` sont null). Les fichiers d'un même export en lot portent le même `lot` et, pour chacun, le nombre de `suivants` à ranger encore (0
// pour le dernier) : la personne peut alors répondre une fois pour tous. GFS ne dit rien par-dessus l'app : un refus rejette avec son `code` (`GFS_REFUSE`, `GFS_ACCES`, `GFS_LECTURE_SEULE`, `GFS_ANNULE`,
// `GFS_ECHEC`, `GFS_INACTIF`, ou `GFS_INCONNU` d'un GFS qui ne sait pas encore ranger) et sa phrase, que l'app écrit dans son coin d'état. Chaque appel est un fichier de plus : GFS les prend l'un après l'autre.
// `onClose` est la réponse à l'appel `fermer` : GFS ne détruit le cadre de l'app qu'après `{ ferme: true }`. L'abonné rend (ou résout) exactement `true` pour laisser partir l'app, après avoir enregistré
// ce qui attend (enregistrement automatique allumé : sans question) ou après la question de l'app ; tout autre retour est `{ ferme: false }` (la personne a annulé : tout reste en place) ; une erreur qu'il lève part avec
// son texte et GFS demande à la personne. Sans abonné, l'app répond `GFS_INCONNU` et part comme avant ; sans réponse au bout de 10 secondes, GFS demande à la personne s'il doit fermer quand même.
// `onDelete` répond à `supprimer { fichier: { id, type }, raison }` (`raison` vaut `corbeille`) : l'abonné ferme ce qui est public (le lien d'un formulaire), puis rend (ou résout) `{ fait: true }` ; `{ fait: false, dit }` quand
// il ne peut pas (`dit`, une phrase d'une ligne, 200 signes au plus : GFS l'ajoute à la sienne) ; rendre seulement `true` ou `false` suffit. `onDuplicate` répond à `dupliquer { fichier: { id, type }, nom }` : l'abonné copie
// le fichier en entier sous ce nom, sans le publier, et rend `{ id, nom?, dit? }` (`id` : la copie, `nom` seulement s'il l'a changé) ; `{ dit }` sans `id` veut dire qu'il n'a rien copié. Une erreur qu'un abonné lève part avec son
// texte ; sans abonné, `GFS_INCONNU` comme avant (GFS le dit à la personne).
// Chaque abonné (`on…`) est rappelé quand la valeur change, l'arrivée du contexte comprise, et chaque `on…` rend de quoi se désabonner. Seule, l'app n'écoute ni n'envoie rien : le
// contexte, l'ouverture, la langue, la barre, l'identité et l'ambiance sont null, les extensions vides. Un message n'est lu que s'il vient du cadre parent (`event.source`) et porte le contrat de GFS ;
// l'écoute passe par addEventListener, jamais par `window.onmessage =`, qui remplacerait celle du script d'API de Grist.
import { once } from './once.js';
import { hostContract } from './host.js';
import { normalizeAmbiance } from './ambiance-message.js';

once('gfs-link', import.meta.url);

const CONTRACT = 0;                              // le contrat que parle l'app, celui de son manifeste (contrats 5.1, point 1)
const CONTEXT_TIMEOUT_MS = 5000;                 // 5.1, point 4 : l'app attend `contexte` 5 secondes au plus
const ID = /^[a-z][a-z0-9_-]{0,63}$/;            // un identifiant d'extension ou de bibliothèque
const STORAGE_KEY = /^[A-Za-z0-9_.:-]{1,64}$/;   // 5.3, point 2 : la forme d'une clé, la même seule et dans GFS
const EDGES = ['gauche', 'haut', 'droite', 'bas'];
// Les champs du contexte qui ne changent pas tant que le cadre vit ; la langue, la barre, l'identité, l'ambiance, les extensions, l'ouverture et le stockage ont chacun leur lecture.
const FIXED = ['contrat', 'hote', 'instance', 'document', 'page', 'section', 'adresseWidget', 'culture', 'fuseau', 'devise', 'lectureSeule', 'acces'];

const isObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const text = value => (typeof value === 'string' ? value : '');
const copy = value => (value == null ? null : structuredClone(value));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const validKey = key => typeof key === 'string' && STORAGE_KEY.test(key);

const isBlob = value => typeof Blob !== 'undefined' && value instanceof Blob;

// `importation: { valeur, fichier }` (raison `importer`) et `lecture: { id, fichier }` (raison `lire`) : le `File` que la personne a choisi ou que GFS a téléchargé, gardé tel qu'il est arrivé (il ne se
// copie pas). Sans un vrai `File` ou `Blob`, la clé n'est pas gardée : mieux vaut qu'elle manque que de faire croire à l'app qu'elle a un fichier.
const normalizeImportation = raw => (isObject(raw) && isBlob(raw.fichier) ? { valeur: text(raw.valeur), fichier: raw.fichier } : null);
const normalizeReading = raw => (isObject(raw) && isBlob(raw.fichier) && raw.id != null && String(raw.id).trim() !== '' ? { id: String(raw.id).trim(), fichier: raw.fichier } : null);

// `ouverture` du contexte (contrats 5.2, point 3) ou `args` de l'appel `ouvrir` (5.4) : { fichier, type, dossier, raison }, où `fichier` est null (« Nouveau ») ou { id, type }, l'`id` pris
// comme texte ; plus `importation` ou `lecture` quand GFS passe un fichier à l'app. null quand ce n'est pas un objet.
function normalizeOpening(raw) {
  if (!isObject(raw)) return null;
  const file = isObject(raw.fichier) && raw.fichier.id != null && String(raw.fichier.id).trim() !== '' ? raw.fichier : null;
  const opening = { fichier: file ? { id: String(file.id).trim(), type: text(file.type) } : null, type: text(raw.type), dossier: text(raw.dossier), raison: text(raw.raison) };
  const importation = normalizeImportation(raw.importation);
  const reading = normalizeReading(raw.lecture);
  if (importation) opening.importation = importation;
  if (reading) opening.lecture = reading;
  return opening;
}

// La copie de l'ouverture que l'app lit : chaque lecture la sienne, sauf le fichier passé, qui est le même `File` (il ne se copie pas, et la copie d'un `File` perd son nom hors des navigateurs).
function copyOpening(opening) {
  if (opening === null) return null;
  const { importation, lecture, ...rest } = opening;
  return { ...copy(rest), ...(importation ? { importation: { ...importation } } : {}), ...(lecture ? { lecture: { ...lecture } } : {}) };
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

// `identite` du contexte ou de l'événement (5.2, point 9) : { email }, l'adresse telle que Grist la donne (la casse est gardée). null quand ce n'est pas une adresse : l'app fait alors comme seule,
// plutôt que de croire une forme inconnue.
function normalizeIdentity(raw) {
  const email = isObject(raw) && typeof raw.email === 'string' ? raw.email.trim() : '';
  return /^[^@\s]+@[^@\s]+$/.test(email) ? { email } : null;
}

// `stockage` du contexte (5.3, point 1) : l'espace de cette app chez GFS, une Map clé -> texte. Une clé hors de la règle ou une valeur qui n'est pas un texte n'est pas gardée ; null quand ce
// n'est pas un objet (un GFS d'avant le 21/10 n'en donne pas : les choix ne se gardent alors pas).
function normalizeStorage(raw) {
  return isObject(raw) ? new Map(Object.entries(raw).filter(([key, value]) => validKey(key) && typeof value === 'string')) : null;
}

// La clé d'un lien (5.4, points 2 et 7) : { app, id, type } avec l'`id` pris comme texte, ou null quand ce n'est pas une clé. `choisir` y ajoute le `nom` que la personne a vu.
function normalizeKey(raw) {
  if (!isObject(raw) || typeof raw.app !== 'string' || raw.app === '' || raw.id == null || String(raw.id).trim() === '' || typeof raw.type !== 'string' || raw.type === '') return null;
  return { app: raw.app, id: String(raw.id).trim(), type: raw.type };
}
function normalizeChoice(raw) {
  const key = normalizeKey(raw);
  return key ? { app: key.app, id: key.id, nom: text(raw.nom), type: key.type } : null;
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
function setIdentity(link, raw) {
  const next = normalizeIdentity(raw);
  if (same(next, link.identity)) return;
  link.identity = next;
  notify(link.listeners.identity, () => copy(next));
}
function setAmbiance(link, raw) {
  const next = normalizeAmbiance(raw);
  if (same(next, link.ambiance)) return;
  link.ambiance = next;
  notify(link.listeners.ambiance, () => copy(next));
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
  setIdentity(link, data.identite);
  setAmbiance(link, data.ambiance);
  setExtensions(link, data);
}

// Les cinq événements de GFS (5.2, points 2, 9 et 10), chacun avec son corps ; un autre est ignoré (5.1, point 3).
const EVENTS = {
  langue: (link, data) => setLanguage(link, data.langue), barre: (link, data) => setBar(link, data.barre),
  identite: (link, data) => setIdentity(link, data.identite), ambiance: (link, data) => setAmbiance(link, data.ambiance), extensions: setExtensions,
};
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

// Donne un appel de GFS à l'abonné et rend sa réponse : `data(valeur)` en fait le corps ; une erreur qu'il lève part avec son texte, que GFS dit à la personne. Sans `id`, l'appel n'attend pas de
// réponse (5.1, point 2).
function deliver(link, id, run, data, what) {
  const reply = fields => { if (id !== null) post(link, { id, ...fields }); };
  let result;
  try { result = Promise.resolve(run()); } catch (error) { result = Promise.reject(error); }
  result.then(value => reply({ type: 'reponse', data: data(value) }), (error) => {
    console.warn(`[GfsLink] ${what} demandée par GFS en échec`, error);
    reply({ type: 'erreur', message: String((error && error.message) || error || '').slice(0, 200) });
  });
}

// `ouvrir` (5.4, point 1) : `{ ouvert: true }` quand l'abonné rend vrai, `{ ouvert: false }` sinon (la personne a annulé, ou l'app a dit elle-même pourquoi : GFS n'ajoute rien).
function deliverOpen(link, request) {
  deliver(link, request.id, () => link.openHandler(request.args), opened => ({ ouvert: opened === true }), 'ouverture');
}

// `fermer` (5.4, point 3) : `{ ferme: true }` quand l'abonné rend vrai (l'app a enregistré ou la personne a abandonné), `{ ferme: false }` sinon (la personne a annulé : tout reste en place).
function deliverClose(link, request) {
  deliver(link, request.id, () => link.closeHandler({ raison: request.raison }), closed => ({ ferme: closed === true }), 'fermeture');
}

const sentence = value => (typeof value === 'string' ? value.slice(0, 200) : '');

// `supprimer` (5.4, point 10) : `{ fait: true }` quand l'abonné le dit (`{ fait: true }` ou `true`), `{ fait: false }` sinon ; `dit` suit quand c'est une phrase.
function deleteReply(outcome) {
  const done = isObject(outcome) ? outcome.fait === true : outcome === true;
  const dit = isObject(outcome) ? sentence(outcome.dit) : '';
  return dit ? { fait: done, dit } : { fait: done };
}

// `dupliquer` (5.4, point 11) : `id` seulement quand c'est un texte ou un nombre non vide (une copie), `nom` seulement avec lui, `dit` quand c'est une phrase ; `{}` : rien n'a été copié.
function copyReply(outcome) {
  const given = isObject(outcome) ? outcome : {};
  const reply = {};
  if ((typeof given.id === 'string' || typeof given.id === 'number') && String(given.id) !== '') {
    reply.id = given.id;
    if (typeof given.nom === 'string' && given.nom !== '') reply.nom = given.nom.slice(0, 200);
  }
  const dit = sentence(given.dit);
  if (dit) reply.dit = dit;
  return reply;
}

// Les deux appels sur un fichier de l'app : le fichier est `{ id, type }` (texte ou nombre, texte), le reste est `raison` pour `supprimer`, `nom` pour `dupliquer`.
function deliverFileCall(link, id, message) {
  const args = isObject(message.args) ? message.args : {};
  const file = isObject(args.fichier) ? args.fichier : {};
  const fichier = { id: typeof file.id === 'string' || typeof file.id === 'number' ? file.id : null, type: typeof file.type === 'string' ? file.type.slice(0, 80) : '' };
  if (message.nom === 'supprimer') {
    const request = { fichier, raison: typeof args.raison === 'string' ? args.raison.slice(0, 40) : '' };
    deliver(link, id, () => link.deleteHandler(request), deleteReply, 'mise à la corbeille');
  } else {
    const request = { fichier, nom: typeof args.nom === 'string' ? args.nom.slice(0, 200) : '' };
    deliver(link, id, () => link.copyHandler(request), copyReply, 'copie');
  }
}

const FILE_CALLS = { supprimer: 'deleteHandler', dupliquer: 'copyHandler' };

// Un appel de GFS vers l'app : `ouvrir` va à celui qui s'est inscrit (onOpen), dans l'ordre d'arrivée, même avant son inscription ; `fermer`, `supprimer` et `dupliquer` à celui de onClose, onDelete et
// onDuplicate, quand il y en a un ; tout autre nom (et ces trois sans abonné : l'app n'a rien à y faire qu'elle sache) reçoit `GFS_INCONNU` (5.1, point 3).
function receiveCall(link, message) {
  const id = Number.isInteger(message.id) ? message.id : null;
  if (Object.hasOwn(FILE_CALLS, message.nom) && link[FILE_CALLS[message.nom]]) {
    deliverFileCall(link, id, message);
    return;
  }
  if (message.nom === 'fermer' && link.closeHandler) {
    const raison = isObject(message.args) && typeof message.args.raison === 'string' ? message.args.raison.slice(0, 40) : '';
    deliverClose(link, { id, raison });
    return;
  }
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

const failure = (message, code) => Promise.reject(Object.assign(new Error(message), { code }));

// Une demande de lien en cours n'est posée qu'une fois : la même (deux clics pendant que l'explorateur de GFS est ouvert) rend la même promesse, un autre choix en même temps est refusé.
function shared(link, key, start, alone) {
  if (alone && [...link.linking.keys()].some(other => other.startsWith(alone) && other !== key)) return failure('Un choix de fichier est déjà en cours', 'GFS_REFUSE');
  if (!link.linking.has(key)) {
    const request = start();
    const settled = () => link.linking.delete(key);
    link.linking.set(key, request);
    request.then(settled, settled);
  }
  return link.linking.get(key);
}

// Fait désigner à la personne un fichier d'une autre app, dans l'explorateur de GFS en mode choix (5.4, point 2). `types` : les types voulus (GFS n'en montre que ceux que les apps offrent à choisir) ;
// `apps` : seulement celles-ci ; `titre` : le texte que GFS montre, déjà traduit. Rend { app, id, nom, type }, ou null quand la personne annule. Sans types, la demande ne part pas.
function choose(link, request) {
  if (!link.hosted) return Promise.reject(new Error('GFS absent'));
  const list = value => (Array.isArray(value) ? [...new Set(value.filter(item => typeof item === 'string' && item.trim() !== ''))] : []);
  const args = { types: list(request && request.types) };
  if (request && request.apps !== undefined) args.apps = list(request.apps);
  if (request && typeof request.titre === 'string') args.titre = request.titre;
  if (args.types.length === 0) return failure('choose : au moins un type est attendu', 'GFS_REFUSE');
  return shared(link, `choisir:${JSON.stringify(args)}`, () => call(link, 'choisir', args).then(normalizeChoice), 'choisir:');
}

// Demande à GFS d'ouvrir le fichier que désigne la clé { app, id, type } (5.4, point 7). Rend `true` quand l'app l'a ouvert, `false` quand la personne a annulé dans l'app. Si l'app visée n'est pas
// celle-ci, elle prend sa place (une seule app à la fois) : la promesse ne se règle pas. Un fichier disparu rejette avec `GFS_INTROUVABLE`, une app que la personne ne débloque pas avec `GFS_ANNULE`.
function openFile(link, target) {
  if (!link.hosted) return Promise.reject(new Error('GFS absent'));
  const key = normalizeKey(target);
  if (!key) return failure('openFile : { app, id, type } est attendu', 'GFS_REFUSE');
  const args = { app: key.app, fichier: { id: key.id, type: key.type } };
  return shared(link, `ouvrir:${JSON.stringify(args)}`, () => call(link, 'ouvrir', args).then(data => isObject(data) && data.ouvert === true));
}

// `ranger` rend { statut, id, nom } (5.4, point 9) : `id` est celui du fichier chez GFS (en texte), `nom` son nom chez GFS ; l'un et l'autre null quand la personne n'en a pas voulu (`ignore`).
// Un statut d'un GFS plus récent que ce kit est rendu tel quel : l'app l'ignore plutôt que de le prendre pour un autre.
function normalizeDeposit(raw) {
  const data = isObject(raw) ? raw : {};
  return { statut: text(data.statut), id: data.id == null || String(data.id).trim() === '' ? null : String(data.id).trim(), nom: typeof data.nom === 'string' && data.nom !== '' ? data.nom : null };
}

// Demande à GFS de garder un fichier que l'app vient de fabriquer (5.4, point 9) : `fichier` (un `File` ou un `Blob`) et `nom` sont attendus, `type` (`pdf`, le seul que GFS garde), `lot`, `suivants` et
// `dossier` suivent tels quels ; GFS en vérifie les limites (`GFS_REFUSE`, avec sa phrase). Pas de partage entre deux demandes, contrairement à `choose` : chaque appel est un fichier de plus, que GFS prend à son tour.
// Pas de délai non plus : la personne répond à la question d'un nom pris quand elle veut. Rend { statut, id, nom } ; un refus de GFS rejette avec son `code`.
function deposit(link, request) {
  if (!link.hosted) return Promise.reject(new Error('GFS absent'));
  const asked = isObject(request) ? request : {};
  if (!isBlob(asked.fichier) || typeof asked.nom !== 'string' || asked.nom.trim() === '') return failure('deposit : { fichier (un File ou un Blob), nom } est attendu', 'GFS_REFUSE');
  const args = { fichier: asked.fichier, nom: asked.nom };
  for (const key of ['type', 'lot', 'suivants', 'dossier']) if (asked[key] !== undefined) args[key] = asked[key];
  return call(link, 'ranger', args).then(normalizeDeposit);
}

function onOpen(link, fn) {
  link.openHandler = fn;
  for (const request of link.earlyOpens.splice(0)) deliverOpen(link, request);
  return () => { if (link.openHandler === fn) link.openHandler = null; };
}

// Un seul abonné par appel de GFS : le dernier remplace l'autre, et se désabonner d'un abonné remplacé ne retire pas le nouveau.
function setHandler(link, key, fn) {
  link[key] = fn;
  return () => { if (link[key] === fn) link[key] = null; };
}

function newLink(host) {
  const framed = Boolean(host && host.parent) && host.parent !== host;
  const contract = framed ? hostContract(host.location && host.location.search) : null;
  return {
    host, contract, hosted: contract !== null, known: false, nextId: 1,
    context: null, opening: null, language: null, bar: null, identity: null, ambiance: null, storage: null, extensions: [], libraries: new Map(),
    listeners: { language: new Set(), bar: new Set(), identity: new Set(), ambiance: new Set(), extensions: new Set() },
    pending: new Map(), installing: new Map(), linking: new Map(), openHandler: null, earlyOpens: [], closeHandler: null, deleteHandler: null, copyHandler: null,
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
    opening: () => copyOpening(link.opening),
    language: () => link.language,
    bar: () => copy(link.bar),
    identity: () => copy(link.identity),
    ambiance: () => copy(link.ambiance),
    extensions: () => link.extensions.slice(),
    library: id => copy(link.libraries.get(id)),
    storageGet: key => storageGet(link, key),
    storageSet: (key, value) => storageSet(link, key, value),
    hideBar: hidden => hideBar(link, hidden),
    install: extension => install(link, extension),
    choose: request => choose(link, request),
    openFile: target => openFile(link, target),
    deposit: request => deposit(link, request),
    // Un lien `mailto:` ou `tel:` suivi dans le cadre isolé de GFS le fait mourir (contrats 1.3, point 1) : hébergée, l'app l'ouvre dans un nouvel onglet. Seule, faux.
    opensInNewTab: href => link.hosted && /^(?:mailto|tel):/i.test(String(href == null ? '' : href).trim()),
    onOpen: fn => onOpen(link, fn),
    onClose: fn => setHandler(link, 'closeHandler', fn),
    onDelete: fn => setHandler(link, 'deleteHandler', fn),
    onDuplicate: fn => setHandler(link, 'copyHandler', fn),
    onLanguage: fn => subscribe(link.listeners.language, fn),
    onBar: fn => subscribe(link.listeners.bar, fn),
    onIdentity: fn => subscribe(link.listeners.identity, fn),
    onAmbiance: fn => subscribe(link.listeners.ambiance, fn),
    onExtensions: fn => subscribe(link.listeners.extensions, fn),
  });
}

// Le lien de la page : celui que lisent l'app et ses extensions.
export const GfsLink = createGfsLink();
