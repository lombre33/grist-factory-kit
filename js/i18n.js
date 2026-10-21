// Traduction français / anglais, commune aux apps et à GFS. Le kit apporte le moteur ; les textes d'une app restent dans le dépôt de l'app, une entrée par clé avec le français et
// l'anglais côte à côte (impossible de changer l'un sans voir l'autre) :
//   I18n.add({ 'form.title': { fr: 'Titre du formulaire', en: 'Form title' } });
//   I18n.init({ storageKey: 'formplus_lang' });     // la langue, d'après les trois sources ci-dessous
//   I18n.translateDom();                            // le HTML écrit à la main : data-i18n, data-i18n-title, data-i18n-aria, data-i18n-placeholder
//   I18n.t('form.count', { n: 3 })                  // « {n} {n|question|questions} » -> « 3 questions »
// La langue au premier lancement (charte, choix du 04/10) : celle de GFS quand il héberge l'app (`gfs=<n>` et `language` dans l'adresse du cadre, contrats 1.3) ; sinon le choix
// que la personne a fait dans l'app (enregistré sous `storageKey`, seulement quand elle choisit) ; sinon la première langue du navigateur parmi le français et l'anglais, l'anglais
// quand il n'en propose aucune des deux, le français quand il ne dit rien. Dans GFS, l'app suit ensuite `contexte.langue` et l'événement `langue` par `setLanguage`.
// Les clés du kit commencent par `kit.` ; celles d'une app prennent le préfixe de l'app.
import { once } from './once.js';

once('i18n', import.meta.url);

export const LANGUAGES = Object.freeze(['fr', 'en']);
const supported = value => (LANGUAGES.includes(value) ? value : null);

// Les textes du kit lui-même (boutons par défaut des fenêtres) : lus aussi par les essais, qui vérifient le français et l'anglais côte à côte.
export const KIT_STRINGS = Object.freeze({
  'kit.cancel': { fr: 'Annuler', en: 'Cancel' },
  'kit.confirm': { fr: 'Valider', en: 'Confirm' },
  'kit.close': { fr: 'Fermer', en: 'Close' },
});

// La langue que GFS donne au cadre de l'app (`language` n'est lue qu'avec `gfs=<n>` : seule, l'app n'est pas obligée de suivre la langue de Grist). null quand GFS n'en donne pas une des deux.
export function hostedLanguage(search) {
  const params = new URLSearchParams(search || '');
  if (!/^\d{1,6}$/.test(params.get('gfs') || '')) return null;
  return supported(String(params.get('language') || '').toLowerCase());
}

// La première langue du navigateur parmi les deux ; l'anglais s'il en propose d'autres seulement, le français s'il ne dit rien.
export function browserLanguage(tags) {
  const asked = (tags || []).filter(Boolean);
  for (const tag of asked) {
    const code = supported(String(tag).toLowerCase().split('-')[0]);
    if (code) return code;
  }
  return asked.length ? 'en' : 'fr';
}

export function resolveLanguage({ hosted, stored, browser } = {}) {
  return supported(hosted) || supported(stored) || browserLanguage(browser);
}

// Le groupe `{n|singulier|pluriel}` qui s'ouvre en `start`, ou null : { name, one, other, end }. Une forme peut contenir d'autres `{variable}` ou un autre pluriel (les accolades
// se comptent). Une accolade sans nom de variable connu, ou jamais refermée, n'est pas un pluriel.
function pluralGroup(text, start, vars) {
  const head = /^\{(\w+)\|/.exec(text.slice(start));
  if (!head || !vars || !(head[1] in vars)) return null;
  let depth = 0;
  let split = -1;
  for (let at = start; at < text.length; at++) {
    const char = text[at];
    if (char === '{') depth++;
    else if (char === '|' && depth === 1 && split < 0 && at >= start + head[0].length) split = at;
    else if (char === '}' && --depth === 0) {
      if (split < 0) return null;
      return { name: head[1], one: text.slice(start + head[0].length, split), other: text.slice(split + 1, at), end: at };
    }
  }
  return null;
}

// Les pluriels d'abord, les variables simples ensuite, en un seul passage : le texte d'une variable (nom de colonne, valeur saisie) n'est jamais relu comme un pluriel ni comme une
// autre variable. Règles de la langue (`rules`, un Intl.PluralRules) : en français 0 et 1 sont au singulier, en anglais seul 1.
function expandPlurals(text, vars, rules) {
  let out = '';
  let at = 0;
  while (at < text.length) {
    const open = text.indexOf('{', at);
    if (open < 0) return out + text.slice(at);
    out += text.slice(at, open);
    const group = pluralGroup(text, open, vars);
    if (!group) { out += '{'; at = open + 1; continue; }
    out += expandPlurals(rules.select(Number(vars[group.name])) === 'one' ? group.one : group.other, vars, rules);
    at = group.end + 1;
  }
  return out;
}

const fill = (text, vars, rules) => expandPlurals(text, vars, rules).replace(/\{(\w+)\}/g, (all, name) => (name in vars ? String(vars[name]) : all));

function browserTags() {
  if (!globalThis.navigator) return [];
  return navigator.languages && navigator.languages.length ? [...navigator.languages] : [navigator.language];
}

// Le navigateur peut refuser son stockage (cadre isolé de GFS, navigation privée) : la lecture rend null, l'écriture false, rien ne s'arrête.
function readStored(key) {
  try { return key ? localStorage.getItem(key) : null; } catch (error) { return null; }
}
function writeStored(key, value) {
  try { localStorage.setItem(key, value); return true; } catch (error) { return false; }
}

// Le HTML écrit à la main : le texte d'abord, puis les attributs. Le français écrit dans la page reste le repli tant que ce module n'a pas chargé.
const ATTRIBUTES = [['data-i18n-title', 'title'], ['data-i18n-aria', 'aria-label'], ['data-i18n-placeholder', 'placeholder']];
function translateNodes(root, t) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.getAttribute('data-i18n')); });
  for (const [from, to] of ATTRIBUTES) root.querySelectorAll(`[${from}]`).forEach(el => el.setAttribute(to, t(el.getAttribute(from))));
}

export function createI18n({ strings = {}, language = 'fr' } = {}) {
  const entries = new Map();
  const listeners = [];
  const warned = new Set();
  let current = supported(language) || 'fr';
  let rules = new Intl.PluralRules(current);
  let storageKey = null;

  const warnOnce = message => {
    if (warned.has(message)) return;
    warned.add(message);
    console.warn(`[I18n] ${message}`);
  };

  function add(more) {
    for (const [key, entry] of Object.entries(more)) {
      const known = entries.get(key);
      if (known && (known.fr !== entry.fr || known.en !== entry.en)) warnOnce(`clé redéfinie : ${key}`);
      entries.set(key, entry);
    }
  }

  function t(key, vars) {
    const entry = entries.get(key);
    if (!entry) { warnOnce(`clé inconnue : ${key}`); return key; }
    let text = entry[current];
    if (typeof text !== 'string') { warnOnce(`traduction « ${current} » manquante pour « ${key} » (repli sur le français)`); text = entry.fr; }
    return vars ? fill(text, vars, rules) : text;
  }

  // La langue qui vaut maintenant : l'attribut `lang` de la page la suit, et les écouteurs (onChange) la reçoivent une fois, quand elle change.
  function apply(next) {
    const changed = next !== current;
    current = next;
    rules = new Intl.PluralRules(current);
    if (typeof document !== 'undefined') document.documentElement.lang = current;
    if (changed) for (const listener of [...listeners]) listener(current);
  }

  // Choisit la langue d'après les trois sources ; chacune peut être donnée (`hosted`, `stored`, `browser`), pour un essai ou une app qui a sa propre façon de la dire.
  function init(options = {}) {
    storageKey = options.storageKey || null;
    const hosted = 'hosted' in options ? options.hosted : hostedLanguage(globalThis.location ? location.search : '');
    const stored = 'stored' in options ? options.stored : readStored(storageKey);
    const browser = 'browser' in options ? options.browser : browserTags();
    apply(resolveLanguage({ hosted, stored, browser }));
    return current;
  }

  add(strings);
  return {
    add,
    init,
    t,
    has: key => entries.has(key),
    get language() { return current; },
    // Sans effet sur une valeur inconnue ou la même.
    setLanguage: next => { if (supported(next)) apply(next); },
    // Garde la langue pour le prochain lancement (init la relit). false : pas de clé, ou stockage indisponible : la langue ne survivrait pas au rechargement.
    store: next => Boolean(storageKey && supported(next) && writeStored(storageKey, next)),
    translateDom: (root = document) => translateNodes(root, t),
    onChange(listener) {
      listeners.push(listener);
      return () => { const at = listeners.indexOf(listener); if (at >= 0) listeners.splice(at, 1); };
    },
  };
}

// Une langue par page : les fenêtres du kit et l'app lisent celle-ci.
export const I18n = createI18n({ strings: KIT_STRINGS });
