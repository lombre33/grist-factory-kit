// Ordre d'empilement des couches flottantes : barres flottantes d'une sélection, menus et listes, info-bulles. La règle (le dernier menu ouvert est toujours au-dessus de l'existant)
// est posée ici, une fois, plutôt que menu par menu : chaque couche avait son z-index en dur, sans ordre entre elles.
//  - Les niveaux sont fixes : des jetons CSS (--z-floating-toolbar < --z-menu < --z-tip < --z-window < --z-dialog, css/tokens.css), jamais un nombre en dur dans une feuille.
//  - Dans le niveau des menus et au-dessus, Layers.raise(el) met l'élément qui vient de s'ouvrir au-dessus de ceux déjà ouverts : z-index en ligne = niveau + rang. Le niveau d'un
//    élément est celui que sa feuille de style lui donne ; la pile ne garde que les éléments encore affichés.
//  - Les barres flottantes ne sont pas rangées : un geste en ouvre souvent deux (cliquer une bulle dans une case de tableau ouvre la barre de la bulle et celle du tableau), et « la
//    dernière ouverte au-dessus » mettrait celle du tableau sur celle de la bulle. Elles gardent l'ordre du DOM (la plus précise est créée après la plus générale) ; raise ne fait
//    rien pour elles.
//  - Un popup ouvert depuis le champ d'une fenêtre passe devant elle : Layers.raise(el, fenêtre) prend pour niveau le z-index de cette fenêtre + 1, lu à chaque appel. Un élément
//    n'a qu'un niveau à la fois (la liste d'une recherche sert à l'éditeur puis à une fenêtre) : en changer le retire de la pile de l'ancien.
// À appeler à l'ouverture d'une couche flottante (ou à chaque placement d'un popup en cours d'usage), jamais à chaque recalage d'une barre déjà affichée.
import { once } from './once.js';

once('layers', import.meta.url);

const WIDTH = 100; // largeur d'un niveau : le rang ne le dépasse jamais, deux niveaux ne se recouvrent donc pas
const stacks = new Map(); // niveau -> éléments ouverts à ce niveau, du plus bas au plus haut
// élément -> son niveau, lu une seule fois : le premier rang posé en ligne masquerait ensuite celui de la feuille de style
const levels = new WeakMap();
let toolbarLevel; // niveau des barres flottantes (jeton --z-floating-toolbar de :root), lu une fois la feuille de style chargée

function levelOf(el) {
  let level = levels.get(el);
  if (level === undefined) {
    level = parseInt(getComputedStyle(el).zIndex, 10);
    if (level > 0) levels.set(el, level);
  }
  return level;
}
function isShown(el) { return el.isConnected && el.getClientRects().length > 0; }
function isToolbarLevel(level) {
  if (!(toolbarLevel > 0)) toolbarLevel = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--z-floating-toolbar'), 10);
  return level === toolbarLevel;
}

// Le niveau juste au-dessus de la fenêtre `over` (0 sans fenêtre ou sans z-index) : lu à chaque appel, une fenêtre pouvant être au niveau des fenêtres ou à celui des saisies.
function levelAbove(over) {
  if (!over || !over.isConnected) return 0;
  const z = parseInt(getComputedStyle(over).zIndex, 10);
  return z > 0 ? z + 1 : 0;
}

function raise(el, over) {
  if (!el || !el.isConnected) return;
  const base = levelOf(el);
  if (!(base > 0) || isToolbarLevel(base)) return; // aucun niveau en CSS, ou barres flottantes : rien à ordonner (ordre du DOM, voir plus haut)
  const level = Math.max(base, levelAbove(over));
  stacks.forEach((members, other) => {
    const at = other === level ? -1 : members.indexOf(el);
    if (at >= 0) members.splice(at, 1);
  });
  const stack = (stacks.get(level) || []).filter(other => other !== el && isShown(other));
  stack.push(el);
  stacks.set(level, stack);
  stack.forEach((member, rank) => { member.style.zIndex = String(level + Math.min(rank, WIDTH - 1)); });
}

export const Layers = { raise };
