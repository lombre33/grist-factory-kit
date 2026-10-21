// Base commune des fenêtres. Une fenêtre = un voile (`.pp-modal`), un cadre (`.pp-modal-box`) et trois zones : titre, contenu, boutons (css/windows.css). Seul le contenu défile :
// titre et boutons restent visibles, même dans le panneau de 700 × 400 de Grist.
// Le clavier est tenu ici pour la fenêtre du dessus (la dernière ouverte) : Tab et Maj+Tab tournent dans la fenêtre (y compris si le focus est tombé sur <body>) ; Échap la ferme où
// que soit le focus, sauf si un composant l'a déjà pris (une liste avec recherche referme son seul panneau). L'écouteur est sur le document, pas sur la fenêtre : posé sur elle, il ne
// voyait plus rien dès que le focus en sortait. Il se pose avec la première fenêtre ouverte et se retire avec la dernière.
// Un clic sur le voile ne ferme rien, à dessein : il protège une saisie en cours. Aucun texte ici (chaque fenêtre porte les siens, en français et en anglais).
//   const win = ModalBase.create({ id, titleId, size: 'sm' | 'md' | 'lg', onEscape, restoreFocus, boxClass, actionsClass });
//   win.title.textContent = …; win.body.append(…); const { cancel, ok } = win.addButtons(); win.show();
import { h } from './dom.js';
import { once } from './once.js';

once('modal-base', import.meta.url);

const stack = []; // fenêtres ouvertes, la dernière est au-dessus : c'est elle qui reçoit le clavier
const FOCUSABLE = 'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]';

// Éléments atteignables à Tab dans `root`, dans l'ordre du document : ni désactivés, ni cachés (hidden, display:none d'un ancêtre), ni retirés de l'ordre de tabulation
// (tabindex="-1", comme les lignes d'une liste avec recherche).
function focusables(root) {
  return Array.from(root.querySelectorAll(FOCUSABLE)).filter(e =>
    !e.disabled && e.tabIndex >= 0 && !e.closest('[hidden]') && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden');
}

function trapTab(win, event) {
  const list = focusables(win.box);
  if (!list.length) { event.preventDefault(); win.box.focus(); return; }
  const first = list[0];
  const last = list[list.length - 1];
  const active = document.activeElement;
  // Focus hors du cadre (sur <body>, sur le voile après un clic à côté) : on y rentre par le bon bout, au lieu de laisser Tab partir dans la page.
  if (!win.box.contains(active)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); return; }
  if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
}

function onKeydown(event) {
  const win = stack[stack.length - 1];
  if (!win || event.defaultPrevented || (event.key !== 'Escape' && event.key !== 'Tab')) return;
  if (event.key === 'Escape') { event.preventDefault(); win.onEscape(); }
  else trapTab(win, event);
}

// Entrée et sortie de la pile : le clavier n'est écouté que tant qu'une fenêtre est ouverte. `detach` rend l'élément à qui rendre le focus.
function attach(win, opener) {
  win.opener = opener;
  stack.push(win);
  if (stack.length === 1) document.addEventListener('keydown', onKeydown);
}
function detach(win) {
  stack.splice(stack.indexOf(win), 1);
  if (!stack.length) document.removeEventListener('keydown', onKeydown);
  const back = win.opener;
  win.opener = null;
  return back;
}
function giveFocusBack(win, back) {
  if (win.restoreFocus !== false && back && back.isConnected && typeof back.focus === 'function') back.focus();
}

// Le cadre de la fenêtre, sans rien dedans : à remplir par `win.title`, `win.body` (contenu) et `win.actions` (boutons, ou `win.addButtons`), puis à ouvrir par `win.show()`.
// Options : id (du voile : styles et tests s'y accrochent), titleId (du <h3>, aria-labelledby), boxClass et actionsClass, size ('sm' 400 px, 'md' 480 px par défaut, 'lg' 960 px,
// plafonné à la largeur du panneau), onEscape (défaut : fermer), restoreFocus (rendre le focus à l'élément qui l'avait à l'ouverture, vrai par défaut).
function create(opts) {
  const title = h('h3', { id: opts.titleId });
  const body = h('div', { class: 'pp-modal-body' });
  const actions = h('div', { class: opts.actionsClass ? `pp-modal-actions ${opts.actionsClass}` : 'pp-modal-actions' });
  const box = h('div', {
    class: opts.boxClass ? `pp-modal-box ${opts.boxClass}` : 'pp-modal-box',
    tabindex: -1,
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': opts.titleId,
    dataset: { size: opts.size || 'md' },
  }, h('div', { class: 'pp-modal-header' }, title), body, actions);
  const overlay = h('div', { class: 'pp-modal', id: opts.id, tabindex: -1 }, box);
  overlay.style.display = 'none';
  document.body.appendChild(overlay);

  const win = {
    overlay, box, title, body, actions, opener: null, restoreFocus: opts.restoreFocus,
    isOpen: () => stack.includes(win),
    onEscape: () => (opts.onEscape ? opts.onEscape() : win.hide()),
    // Les boutons habituels, dans l'ordre : `first` (un bouton de tête, de la classe donnée : « pp-modal-danger » pour « Retirer »), un espace, Annuler, le bouton principal.
    // Chaque fenêtre pose ses libellés.
    addButtons(firstClass) {
      const button = className => h('button', { type: 'button', class: className });
      const buttons = { first: firstClass ? button(firstClass) : null, cancel: button(), ok: button('pp-modal-primary') };
      actions.append(...[buttons.first, h('span', { class: 'pp-modal-spacer' }), buttons.cancel, buttons.ok].filter(Boolean));
      return buttons;
    },
    // `target` : l'élément (ou la fonction qui le donne) à mettre au premier plan du clavier ; par défaut le premier champ du contenu.
    show(target) {
      if (!win.isOpen()) {
        attach(win, document.activeElement);
        overlay.style.display = 'flex';
      }
      const focusTarget = (typeof target === 'function' ? target() : target) || focusables(body)[0] || focusables(box)[0] || box;
      focusTarget.focus();
    },
    hide() {
      if (!win.isOpen()) return;
      overlay.style.display = 'none';
      giveFocusBack(win, detach(win));
    },
  };
  return win;
}

export const ModalBase = { create };
