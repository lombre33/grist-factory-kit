// Le thème de l'interface : « système », « clair » ou « sombre ». Le choix est celui de la personne, gardé par navigateur (un confort : l'app marche sans, le thème est alors celui du
// système) et jamais écrit dans le document. Il se pose sur <html> en data-theme="light" ou "dark" ; « système » retire l'attribut, et les feuilles du kit (css/tokens.css) suivent
// alors le thème de Grist (data-grist-appearance, posé par son script d'API) puis la préférence du système, sans qu'aucun code n'ait à les observer.
//   Theme.init({ storageKey: 'formplus_theme' });   // à appeler en premier dans le module d'entrée : plus tard, l'app s'afficherait en clair puis basculerait, ce qui se voit
//   Theme.set('dark');                              // 'system' | 'light' | 'dark' : applique, garde (false quand le navigateur refuse le stockage)
//   Theme.isDark();                                 // le thème affiché, pour choisir l'icône d'une bascule ou une couleur calculée
//   Theme.onChange(({ choice, dark }) => …);        // après chaque init et chaque set
// Une valeur gardée qui n'est pas l'une des trois (une ancienne version, une clé vide) vaut « système ».
import { once } from './once.js';

once('theme', import.meta.url);

export const THEMES = Object.freeze(['system', 'light', 'dark']);
const known = value => (THEMES.includes(value) ? value : 'system');

// Le thème affiché : le choix de la personne d'abord, à défaut celui de Grist, à défaut la préférence du système. Même ordre que les feuilles de style.
function isDark() {
  const { theme, gristAppearance } = document.documentElement.dataset;
  for (const source of [theme, gristAppearance]) {
    if (source === 'dark') return true;
    if (source === 'light') return false;
  }
  return Boolean(globalThis.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
}

// Le navigateur peut refuser son stockage (cadre isolé de GFS, navigation privée) : la lecture rend null, l'écriture false, rien ne s'arrête. « Système » retire la clé plutôt que d'y
// écrire un mot : une app qui lit encore l'ancienne forme (clé absente ou vide = système) s'y retrouve.
function readStored(key) {
  try { return key ? localStorage.getItem(key) : null; } catch (error) { return null; }
}
function writeStored(key, choice) {
  if (!key) return false;
  try {
    if (choice === 'system') localStorage.removeItem(key); else localStorage.setItem(key, choice);
    return true;
  } catch (error) { return false; }
}

let storageKey = null;
let choice = 'system';
const listeners = [];

function apply(next) {
  choice = next;
  const root = document.documentElement;
  if (choice === 'system') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', choice);
  for (const listener of [...listeners]) listener({ choice, dark: isDark() });
}

export const Theme = {
  // Lit le choix gardé sous `storageKey` (s'il y en a une) et l'applique. Rend le choix.
  init(options = {}) {
    storageKey = options.storageKey || null;
    apply(known(readStored(storageKey)));
    return choice;
  },
  // Sans effet sur une valeur inconnue. Rend false quand le choix n'a pas pu être gardé (pas de clé, ou stockage indisponible) : il ne survivra pas au rechargement.
  set(next) {
    if (!THEMES.includes(next)) return false;
    apply(next);
    return writeStored(storageKey, next);
  },
  get choice() { return choice; },
  isDark,
  onChange(listener) {
    listeners.push(listener);
    return () => { const at = listeners.indexOf(listener); if (at >= 0) listeners.splice(at, 1); };
  },
};
