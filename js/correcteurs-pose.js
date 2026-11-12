// Couper les correcteurs du navigateur sur la page d'une app quand GFS le dit (contrats de GFS 5.2, point 13 ; guide des apps, règle 21 ; faits vérifiés de GFS, 104) : un correcteur du navigateur
// (LanguageTool) juge chaque cadre d'après sa propre adresse, donc son interrupteur « pour ce site » ne coupe rien dans le cadre d'une app que GFS héberge, et un gros document le fait ramer. GFS ne peut
// pas toucher au texte d'une app (cadre isolé) : la personne coupe par le bouton de sa barre, GFS le dit (`contexte.correcteurs`, événement `correcteurs`) et ce module pose, sur chaque zone de texte
// de la page, la marque `data-lt-active="false"` que LanguageTool respecte, à chaud et sans recharger (mesuré par le porteur de GFS le 12/11 : la marque est sur l'élément éditable LUI-MÊME,
// `contenteditable`, `textarea`, `input` de texte ; posée sur un élément qui l'entoure, elle ne coupe rien).
// Il n'importe ni le lien du kit : une app qui a déjà son propre lien avec GFS (Publipostage+) s'en sert ici sans en démarrer un deuxième dans son cadre. Les apps qui ont le lien du kit prennent
// `js/correcteurs.js` (`Correcteurs.start()`), qui branche celui-ci sur `GfsLink`.
//   const correcteurs = createCorrecteurs({ link }).start();   // une fois, au démarrage de l'app (le module d'entrée) ; deux appels rendent le même
//     link     { correcteurs(), onCorrecteurs(fn), ready } : `correcteurs()` rend `{ coupes }` (js/correcteurs-message.js) ; `onCorrecteurs(fn)` rappelle `fn` à chaque changement et rend de quoi se
//              désabonner ; `ready` se règle quand le contexte de GFS est arrivé (ou que son attente est finie)
//   await correcteurs.ready;   // facultatif : le contexte est arrivé et la marque est posée (jamais rejetée)
//   correcteurs.refresh();     // la page a été refaite d'une façon que ce module ne voit pas (un cadre, une feuille) : tout est repassé
//   correcteurs.stop();        // retire les marques posées ; l'app n'est plus suivie
// Quand `coupes` est vrai, chaque zone de texte de la page reçoit la marque, et celles qui naissent ensuite (une fenêtre, un champ de cellule, un éditeur de champ) la reçoivent aussi, à l'arrivée
// (un `MutationObserver` ; il n'existe que tant que `coupes` est vrai). Quand il est faux, les marques posées par ce module sont retirées, et seulement elles : une marque que l'app a posée
// elle-même n'est jamais touchée. Seule, ou si GFS ne dit rien, l'app ne pose aucune marque : les correcteurs restent comme le navigateur les fait.
import { once } from './once.js';

once('correcteurs-pose', import.meta.url);

export const MARK = 'data-lt-active';
// Ce que la page est interrogée pour trouver des candidats ; `isEditable` tranche (le sélecteur seul ne sait pas lire « contenteditable="false" » dans tous les cas).
export const CANDIDATES = 'textarea, input, [contenteditable]';
export const MARKED = `[${MARK}="false"]`;

const TEXT_INPUTS = new Set(['', 'text', 'search', 'email', 'url', 'tel']);
const EDITABLE_VALUES = new Set(['', 'true', 'plaintext-only']);
const attr = (node, name) => (typeof node.getAttribute === 'function' ? node.getAttribute(name) : null);

// Une zone de texte que LanguageTool peut corriger : `textarea`, `input` de texte (pas un mot de passe, une case, un nombre…) ou élément `contenteditable` qui ne l'est pas à « false ».
export function isEditable(node) {
  if (!node || node.nodeType !== 1) return false;
  const tag = String(node.tagName || '').toLowerCase();
  if (tag === 'textarea') return true;
  if (tag === 'input') return TEXT_INPUTS.has(String(attr(node, 'type') || '').trim().toLowerCase());
  const editable = attr(node, 'contenteditable');
  return editable !== null && EDITABLE_VALUES.has(editable.trim().toLowerCase());
}

// Pose la marque sur `node` et sur les zones de texte qu'il porte ; ce qui l'a déjà (posée par l'app) n'est pas à nous, on n'y touche ni maintenant ni au retrait. `marked` : les zones que ce module a marquées.
function mark(node, marked) {
  const nodes = [node, ...(typeof node.querySelectorAll === 'function' ? node.querySelectorAll(CANDIDATES) : [])];
  for (const candidate of nodes) {
    if (!isEditable(candidate) || attr(candidate, MARK) !== null) continue;
    candidate.setAttribute(MARK, 'false');
    marked.add(candidate);
  }
}

function unmark(root, marked) {
  for (const node of root.querySelectorAll(MARKED)) {
    if (!marked.has(node)) continue;
    node.removeAttribute(MARK);
    marked.delete(node);
  }
}

// Un posé pour une page : `link` tient lieu du lien avec GFS (demandé) ; `doc` et `win` sont la page (ceux du navigateur par défaut, ceux d'un essai sinon).
export function createCorrecteurs({ link, doc = globalThis.document, win = globalThis.window } = {}) {
  if (!link || typeof link.correcteurs !== 'function' || typeof link.onCorrecteurs !== 'function') {
    throw new TypeError('createCorrecteurs : `link` ({ correcteurs(), onCorrecteurs(fn), ready }) est demandé');
  }
  let running = null;

  function begin() {
    const root = doc.documentElement;
    const marked = new WeakSet();
    let observer = null;
    // Une zone qui naît (un nœud ajouté, ou un `contenteditable` ou un `type` qui change) est marquée dans l'instant : ce que la personne tape ensuite l'est déjà.
    const onMutations = records => {
      for (const record of records) {
        if (record.type === 'attributes') mark(record.target, marked);
        else for (const node of record.addedNodes) if (node.nodeType === 1) mark(node, marked);
      }
    };
    const watch = on => {
      if (on && !observer) {
        observer = new win.MutationObserver(onMutations);
        observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['contenteditable', 'type'] });
      } else if (!on && observer) {
        observer.disconnect();
        observer = null;
      }
    };
    const refresh = () => {
      const { coupes } = link.correcteurs();
      watch(coupes);
      if (coupes) mark(root, marked);
      else unmark(root, marked);
    };
    const unsubscribe = link.onCorrecteurs(refresh);
    refresh();
    const ready = Promise.resolve(link.ready).then(refresh);
    const stop = () => {
      unsubscribe();
      watch(false);
      unmark(root, marked);
      running = null;
    };
    return Object.freeze({ ready, refresh, stop });
  }

  return Object.freeze({ start: () => { if (!running) running = begin(); return running; } });
}
