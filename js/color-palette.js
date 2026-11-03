// Le menu de couleur : une palette de dix colonnes sur cinq rangées, les rangées de couleurs que l'app a gardées (facultatives), un pied « Personnalisé… » et, au choix, un bouton qui retire la couleur.
// Du contenu, pas un panneau : l'app le pose dans son menu, sa barre ou sa fenêtre (GFS dans son panneau flottant, une app dans le sien). Les pastilles sont des boutons ; au clavier, une seule étape de
// Tab par rangée, les flèches vont d'une pastille à l'autre, Suppr retire une couleur gardée. Aucun style en ligne : la couleur d'une pastille passe par le CSSOM (`vars`, js/dom.js).
// Repris de Publipostage+ (js/color-palette.js), sans ce qui tient à son éditeur (le panneau flottant, l'historique des modifications, les réglages du menu Bordures) : l'app les garde autour.
//   const palette = createColorPalette({ t, current, noneLabel, saved: [{ id, label, hint, colors, readonly, names }], rows, onPick(color), onCustom(), onNone(), onForget(id, color) });
//   menu.append(palette.element);  palette.mark(color);  palette.focus();  palette.setSaved(rows);
// `t(clé, variables)` : le traducteur (celui du kit par défaut). `rows` : les rangées de la palette à montrer, par rang (toutes par défaut). `noneLabel` : le texte du bouton qui retire la couleur, sans lui pas de bouton.
// `saved` : les rangées que l'app a gardées. Une rangée `readonly` n'a ni croix ni Suppr (les couleurs du thème de l'app, que la personne ne retire pas) ; `names` : le nom de chaque couleur (« Accent 1 »), devant son code dans l'infobulle.
import { h } from './dom.js';
import { I18n } from './i18n.js';
import { ColorMath } from './color-math.js';

// Dix colonnes, cinq rangées. La première : les gris, du noir au blanc. Les quatre suivantes : dix teintes en quatre tons - foncé (4,9:1 au moins sur la page blanche, donc lisible en texte), vif, clair et
// pastel (les fonds de surlignage et de case).
const GRAYS = ['#000000', '#1f2937', '#374151', '#4b5563', '#6b7280', '#9ca3af', '#d1d5db', '#e5e7eb', '#f3f4f6', '#ffffff'];
const HUES = [
  ['#b91c1c', '#ef4444', '#fca5a5', '#ffd6d6'], // rouge
  ['#c2410c', '#f97316', '#fdba74', '#ffe0b3'], // orange
  ['#a16207', '#eab308', '#fde047', '#fff2a8'], // jaune
  ['#15803d', '#22c55e', '#86efac', '#c8f7c5'], // vert
  ['#0f766e', '#14b8a6', '#5eead4', '#c2f5ea'], // turquoise
  ['#0369a1', '#0ea5e9', '#7dd3fc', '#c8e6ff'], // ciel
  ['#1d4ed8', '#3b82f6', '#93c5fd', '#d0dcff'], // bleu
  ['#6d28d9', '#8b5cf6', '#c4b5fd', '#e6d6ff'], // violet
  ['#a21caf', '#d946ef', '#f0abfc', '#f5d0fe'], // fuchsia
  ['#be185d', '#ec4899', '#f9a8d4', '#ffd1e6'], // rose
];
export const COLOR_ROWS = Object.freeze([GRAYS, ...[0, 1, 2, 3].map(tone => HUES.map(hue => hue[tone]))].map(row => Object.freeze(row)));
export const COLOR_COLUMNS = 10;

// Les trois icônes du menu, au trait (charte : ni emoji ni police d'icônes), construites sans HTML.
const SVG_NS = 'http://www.w3.org/2000/svg';
const ICONS = {
  forget: [['path', { d: 'M4 4l8 8M12 4 4 12' }]],
  custom: [['path', { d: 'M8 2.2c2.3 2.6 4 4.7 4 6.8a4 4 0 0 1-8 0c0-2.1 1.7-4.2 4-6.8z' }]],
  none: [['circle', { cx: 8, cy: 8, r: 5.2 }], ['path', { d: 'M4.3 11.7 11.7 4.3' }]],
};
function icon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  const look = { viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false' };
  for (const [key, value] of Object.entries(look)) svg.setAttribute(key, String(value));
  for (const [tag, attributes] of ICONS[name]) {
    const part = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attributes)) part.setAttribute(key, String(value));
    svg.append(part);
  }
  return svg;
}

// Une pastille : un bouton qui a la couleur qu'il porte (`--swatch`) et l'encre de sa coche (`--ink`, celle qui se lit sur cette couleur). `role` : le nom du réglage qu'elle porte (« Accent 1 »), devant son code.
function swatch(color, extra, role) {
  const name = `${role ? `${role} · ` : ''}${color.toUpperCase()}`;
  return h('button', { type: 'button', class: 'cp-swatch', title: name, 'aria-label': name, 'aria-pressed': 'false', dataset: { color }, vars: { '--swatch': color, '--ink': ColorMath.inkOn(color) }, ...extra });
}

// Une rangée de couleurs gardées : son nom, puis ses pastilles, chacune avec sa croix (au survol ou au focus) qui la retire de la rangée ; sans croix quand la rangée est `readonly`. Sans couleur, « Aucune » à côté du nom.
function savedRow(row, t) {
  const items = row.colors.map((color, at) => {
    if (row.readonly) return swatch(color, {}, row.names && row.names[at]);
    const label = t('kit.color.forget', { color: color.toUpperCase() });
    return h('span', { class: 'cp-saved' },
      swatch(color, { 'aria-keyshortcuts': 'Delete', dataset: { color, row: row.id } }),
      h('button', { type: 'button', class: 'cp-forget', tabindex: -1, title: label, 'aria-label': label, dataset: { color, row: row.id } }, icon('forget')));
  });
  return h('div', { class: items.length ? 'cp-row' : 'cp-row is-empty', role: 'group', 'aria-label': row.label, dataset: { row: row.id } },
    h('div', { class: 'cp-row-label', title: row.hint || null }, row.label),
    h('div', { class: 'cp-row-list' }, items.length ? items : h('span', { class: 'cp-row-empty' }, t('kit.color.empty'))));
}

const noop = () => {};

class ColorPalette {
  #t;
  #opts;
  #color = null;
  #rows;

  constructor(options = {}) {
    this.#t = options.t || I18n.t;
    this.#opts = { onPick: noop, onCustom: noop, ...options };
    const t = this.#t;
    const shown = COLOR_ROWS.filter((row, at) => !options.rows || options.rows.includes(at));
    const grid = h('div', { class: 'cp-grid', role: 'group', 'aria-label': t('kit.color.palette') }, shown.flat().map(color => swatch(color)));
    this.#rows = h('div', { class: 'cp-rows' });
    const custom = h('button', { type: 'button', class: 'cp-custom', title: t('kit.color.custom') }, icon('custom'), h('span', {}, t('kit.color.customLabel')));
    const none = options.noneLabel ? h('button', { type: 'button', class: 'cp-none', 'aria-pressed': 'false' }, icon('none'), h('span', {}, options.noneLabel)) : null;
    this.element = h('div', { class: 'cp-body' }, h('div', { class: 'cp-main' }, grid), this.#rows, h('div', { class: 'cp-footer' }, custom, none));
    this.element.addEventListener('click', event => this.#click(event));
    this.element.addEventListener('keydown', event => this.#key(event));
    this.element.addEventListener('focusin', event => this.#stop(event.target));
    this.setSaved(options.saved || []);
    this.mark(options.current);
  }

  // Les rangées gardées sont redessinées à chaque changement : l'app les relit chez elle (le modèle, le document) et les redonne.
  setSaved(rows) {
    this.#rows.replaceChildren(...rows.map(row => savedRow(row, this.#t)));
    this.mark(this.#color);
  }

  // Marque la pastille de `color` (« #1e8449 » ou « rgb(30, 132, 73) »), « Personnalisé… » quand la couleur n'est dans aucune pastille (elle a été composée à la main) et « sans couleur » quand il
  // n'y en a pas. Aucune pastille n'est remplacée : appelée sous la souris, elle ne change pas ce que le bouton enfoncé devient.
  mark(color) {
    const hex = ColorMath.parseCss(color);
    this.#color = color || null;
    let found = false;
    for (const button of this.element.querySelectorAll('.cp-swatch')) {
      const on = Boolean(hex) && button.dataset.color === hex;
      found = found || on;
      button.classList.toggle('is-active', on);
      button.setAttribute('aria-pressed', String(on));
    }
    const custom = this.element.querySelector('.cp-custom');
    custom.classList.toggle('is-active', Boolean(hex) && !found);
    const none = this.element.querySelector('.cp-none');
    if (none) {
      none.classList.toggle('is-active', !hex);
      none.setAttribute('aria-pressed', String(!hex));
    }
    this.#restops();
  }

  // Le clavier va sur la pastille marquée de la palette, ou sur la première.
  focus() {
    const target = this.element.querySelector('.cp-grid .cp-swatch[tabindex="0"]') || this.element.querySelector('.cp-swatch');
    if (target) target.focus();
  }

  // Une seule étape de Tab par rangée : la pastille marquée, à défaut la première.
  #restops() {
    for (const group of this.element.querySelectorAll('.cp-grid, .cp-row-list')) {
      const buttons = [...group.querySelectorAll('.cp-swatch')];
      const stop = buttons.find(button => button.classList.contains('is-active')) || buttons[0];
      for (const button of buttons) button.tabIndex = button === stop ? 0 : -1;
    }
  }

  // Le focus est entré dans une rangée : sa pastille devient l'étape de Tab.
  #stop(target) {
    if (!target.classList.contains('cp-swatch')) return;
    for (const button of target.closest('.cp-grid, .cp-row-list').querySelectorAll('.cp-swatch')) button.tabIndex = button === target ? 0 : -1;
  }

  #click(event) {
    const button = event.target.closest('button');
    if (!button || !this.element.contains(button)) return;
    const { onPick, onCustom, onNone } = this.#opts;
    if (button.classList.contains('cp-swatch')) onPick(button.dataset.color);
    else if (button.classList.contains('cp-custom')) onCustom();
    else if (button.classList.contains('cp-none') && onNone) onNone();
    else if (button.classList.contains('cp-forget')) this.#forget(button.dataset.row, button.dataset.color);
  }

  // Au clavier : Suppr (ou Retour arrière) sur une couleur gardée la retire ; les flèches font circuler dans la rangée.
  #key(event) {
    const { key, target } = event;
    if ((key === 'Delete' || key === 'Backspace') && target.closest('.cp-saved')) {
      event.preventDefault();
      this.#forget(target.dataset.row, target.dataset.color);
      return;
    }
    const group = target.classList.contains('cp-swatch') ? target.closest('.cp-grid, .cp-row-list') : null;
    if (group) this.#arrows(event, group);
  }

  // Gauche et droite d'une pastille à l'autre, haut et bas d'une ligne de la palette à l'autre, Début et Fin ; aucun bouclage : au bord, la flèche ne fait rien.
  #arrows(event, group) {
    const buttons = [...group.querySelectorAll('.cp-swatch')];
    const rowWidth = group.classList.contains('cp-grid') ? COLOR_COLUMNS : Infinity;
    const from = buttons.indexOf(event.target);
    const to = { Home: 0, End: buttons.length - 1, ArrowLeft: from - 1, ArrowRight: from + 1, ArrowUp: from - rowWidth, ArrowDown: from + rowWidth }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    if (to >= 0 && to < buttons.length) buttons[to].focus();
  }

  // L'app retire la couleur de sa rangée (et la redonne par `setSaved`) ; le clavier passe à la première couleur gardée qui reste, à défaut à « Personnalisé… ».
  #forget(row, color) {
    if (!this.#opts.onForget) return;
    this.#opts.onForget(row, color);
    const next = this.element.querySelector('.cp-saved .cp-swatch') || this.element.querySelector('.cp-custom');
    if (next) next.focus();
  }
}

export function createColorPalette(options) { return new ColorPalette(options); }
