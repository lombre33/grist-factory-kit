// La fenêtre « Couleur personnalisée » du sélecteur de couleur : un carré saturation-luminosité et un curseur de teinte pour choisir à la souris, un code hexadécimal et trois champs rouge-vert-bleu pour
// taper la couleur qu'on a déjà, un aperçu face à la couleur de départ et, quand l'app en donne, les cases « garder » qui rangent la couleur dans ses rangées. Deux morceaux :
//  - `ColorEditor` : le contenu (le carré, la teinte, l'aperçu, les champs), sans fenêtre autour : GFS le pose dans sa propre fenêtre, une app le pose où elle veut ;
//  - `ColorDialog.open` : une fenêtre de la base du kit (js/modal-base.js) qui porte un éditeur, avec « Annuler » et « Appliquer » : une app qui a déjà la base du kit n'écrit rien d'autre.
// Elle ne pose rien nulle part : « Appliquer » rend la couleur (#rrggbb) et les rangées cochées à celui qui l'a ouverte. Repris de Publipostage+ (js/color-dialog.js), dont le calcul est dans js/color-math.js.
//   const editor = new ColorEditor({ t, initial, scopes: [{ id, label, hint, checked }], kept, onValidity(valid), onSubmit() });
//   box.append(editor.element);  editor.focus();  editor.color();  editor.valid();  editor.scopes();
//   ColorDialog.open({ t, initial, scopes, onApply({ color, scopes }), onClose() });
import { h } from './dom.js';
import { I18n } from './i18n.js';
import { ColorMath } from './color-math.js';
import { ModalBase } from './modal-base.js';
import { once } from './once.js';

once('color-dialog', import.meta.url);

// La couleur de départ quand l'app n'en a aucune à proposer : le bleu d'accent de la charte.
export const START_COLOR = '#2f6fed';
const CHANNELS = [['r', 'red'], ['g', 'green'], ['b', 'blue']];
const clamp = (n, low, high) => Math.min(high, Math.max(low, n));
let uid = 0;

// À gauche, le carré (saturation de gauche à droite, luminosité de bas en haut) et le curseur de teinte.
function buildArea(t) {
  const thumb = h('div', { class: 'cp-thumb' });
  const area = h('div', { class: 'cp-area', tabindex: 0, role: 'slider', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': t('kit.color.area') }, thumb);
  const hue = h('input', { class: 'cp-hue', type: 'range', min: 0, max: 360, step: 1, 'aria-label': t('kit.color.hue') });
  return { area, thumb, hue, node: h('div', { class: 'cp-left' }, area, hue) };
}

// L'aperçu : la couleur de départ et la nouvelle côte à côte (la nouvelle seule quand il n'y a pas de couleur de départ).
function buildCompare(t, hasInitial) {
  const cell = (cls, key) => {
    const chip = h('div', { class: `cp-chip ${cls}` });
    return { chip, wrap: h('div', { class: 'cp-compare-cell' }, chip, h('span', { class: 'cp-caption' }, t(key))) };
  };
  const before = cell('cp-chip-before', 'kit.color.current');
  const after = cell('cp-chip-after', 'kit.color.new');
  before.wrap.hidden = !hasInitial;
  return { before, after, node: h('div', { class: 'cp-compare' }, before.wrap, after.wrap) };
}

// Le code hexadécimal et les trois champs rouge-vert-bleu, avec la phrase qui dit ce qu'un code lisible doit être.
function buildFields(t, id) {
  const hex = h('input', { class: 'cp-input cp-hex', id: `${id}-hex`, type: 'text', autocomplete: 'off', spellcheck: 'false', maxlength: 12, 'aria-describedby': `${id}-hint` });
  const hint = h('p', { class: 'cp-hint', id: `${id}-hint`, 'aria-live': 'polite' });
  const channels = CHANNELS.map(([key, name]) => {
    const input = h('input', { class: 'cp-input cp-number', type: 'number', min: 0, max: 255, step: 1, inputmode: 'numeric', 'aria-label': t(`kit.color.${name}`) });
    return { key, input, node: h('label', { class: 'cp-channel' }, h('span', {}, t(`kit.color.${key}`)), input) };
  });
  const label = h('label', { class: 'cp-label', for: `${id}-hex` }, t('kit.color.hex'));
  return { hex, hint, channels, node: h('div', { class: 'cp-right' }, label, hex, hint, h('div', { class: 'cp-channels' }, ...channels.map(channel => channel.node))) };
}

// Sous le tout, les rangées où garder la couleur : une case par rangée, cochée comme à la dernière ouverture (`kept`), à défaut comme l'app le demande (`checked`).
function buildKeep(t, scopes, kept) {
  if (!scopes.length) return { boxes: [], node: null };
  const boxes = scopes.map(scope => {
    const box = h('input', { type: 'checkbox', value: scope.id });
    box.checked = scope.id in kept ? Boolean(kept[scope.id]) : Boolean(scope.checked);
    box.addEventListener('change', () => { kept[scope.id] = box.checked; });
    return { box, node: h('label', { class: 'cp-keep-row', title: scope.hint || null }, box, h('span', {}, scope.label)) };
  });
  return { boxes, node: h('fieldset', { class: 'cp-keep' }, h('legend', {}, t('kit.color.keep')), ...boxes.map(item => item.node)) };
}

export class ColorEditor {
  #t;
  #opts;
  #parts;
  #state = null;
  #valid = true;

  // options : { t, initial (#rrggbb, ou rien), scopes: [{ id, label, hint, checked }], kept ({ id: vrai | faux }, gardé par l'appelant d'une ouverture à l'autre), onValidity(valid), onSubmit() }
  constructor(options = {}) {
    this.#opts = options;
    this.#t = options.t || I18n.t;
    const t = this.#t;
    const id = `cp-${++uid}`;
    const square = buildArea(t);
    const compare = buildCompare(t, Boolean(options.initial));
    const fields = buildFields(t, id);
    const keep = buildKeep(t, options.scopes || [], options.kept || {});
    const element = h('div', { class: 'cp-editor' }, h('div', { class: 'cp-editor-main' }, square.node, h('div', { class: 'cp-right-col' }, compare.node, fields.node)), keep.node);
    this.#parts = { element, square, compare, fields, keep };
    this.#wireArea(square);
    this.#wireFields(fields);
    if (options.initial) compare.before.chip.style.setProperty('background', options.initial);
    this.#setColor(options.initial || START_COLOR, null);
  }

  get element() { return this.#parts.element; }
  color() { return this.#state.hex; }
  valid() { return this.#valid; }
  // Les rangées cochées : leurs identifiants.
  scopes() { return this.#parts.keep.boxes.filter(item => item.box.checked).map(item => item.box.value); }
  // Le clavier va au code hexadécimal, sélectionné : taper remplace la couleur.
  focus() {
    this.#parts.fields.hex.focus();
    this.#parts.fields.hex.select();
  }

  // Le carré : un appui, un glissement, ou les flèches (1 %, 10 % avec Maj) ; la teinte : le curseur et les flèches du curseur.
  #wireArea({ area, hue }) {
    area.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      event.preventDefault();
      area.focus();
      area.setPointerCapture(event.pointerId);
      this.#moveTo(event);
    });
    area.addEventListener('pointermove', event => { if (area.hasPointerCapture(event.pointerId)) this.#moveTo(event); });
    area.addEventListener('keydown', event => {
      const step = event.shiftKey ? 0.1 : 0.01;
      const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[event.key];
      if (event.key === 'Enter') { event.preventDefault(); this.#submit(); return; }
      if (!move) return;
      event.preventDefault();
      this.#setHsv({ s: clamp(this.#state.s + move[0], 0, 1), v: clamp(this.#state.v + move[1], 0, 1) });
    });
    hue.addEventListener('input', () => this.#setHsv({ h: Number(hue.value) }));
    hue.addEventListener('keydown', event => this.#enter(event));
  }

  // Le code et les trois champs : une valeur lisible change la couleur sans réécrire le champ en cours de frappe (« #1e8 » reste ce qu'on tape) ; une valeur illisible le marque et grise « Appliquer », l'aperçu
  // garde la couleur d'avant. À la sortie d'un champ lisible, tout reprend la forme de la couleur ; un champ illisible reste marqué (un clic sur « Appliquer » grisé ne pose donc pas en silence la couleur d'avant).
  #wireFields({ hex, channels }) {
    hex.addEventListener('input', () => {
      const color = ColorMath.parseHex(hex.value);
      if (color) this.#setColor(color, 'hex');
      else this.#invalidate(hex, true);
    });
    hex.addEventListener('change', () => { if (!hex.hasAttribute('aria-invalid')) this.#render(null); });
    hex.addEventListener('keydown', event => this.#enter(event));
    for (const { key, input } of channels) {
      input.addEventListener('input', () => {
        const value = Number(input.value);
        if (input.value.trim() === '' || !Number.isInteger(value) || value < 0 || value > 255) { this.#invalidate(input, false); return; }
        this.#setColor(ColorMath.toHex({ ...ColorMath.toRgb(this.#state.hex), [key]: value }), 'channel');
      });
      input.addEventListener('change', () => { if (!input.hasAttribute('aria-invalid')) this.#render(null); });
      input.addEventListener('keydown', event => this.#enter(event));
    }
  }

  // Entrée valide la fenêtre, sauf pendant une composition (accent mort) ou quand un champ est marqué illisible.
  #enter(event) {
    if (event.key !== 'Enter' || event.isComposing) return;
    event.preventDefault();
    this.#submit();
  }

  #submit() {
    if (this.#valid && this.#opts.onSubmit) this.#opts.onSubmit();
  }

  #moveTo(event) {
    const box = this.#parts.square.area.getBoundingClientRect();
    this.#setHsv({ s: clamp((event.clientX - box.left) / box.width, 0, 1), v: 1 - clamp((event.clientY - box.top) / box.height, 0, 1) });
  }

  #setHsv(change) {
    this.#state = { ...this.#state, ...change };
    this.#state.hex = ColorMath.toHex(ColorMath.hsvToRgb(this.#state));
    this.#render(null);
  }

  // Une couleur exacte (code, champ ou couleur de départ) ; `source` est le champ à ne pas réécrire pendant qu'on le tape. La teinte est gardée tant que la couleur est un gris ou un noir (sans teinte
  // propre), sinon le curseur sauterait au rouge à chaque saisie.
  #setColor(color, source) {
    const hsv = ColorMath.rgbToHsv(ColorMath.toRgb(color));
    const grey = hsv.s === 0 || hsv.v === 0;
    this.#state = { h: grey && this.#state ? this.#state.h : hsv.h, s: hsv.s, v: hsv.v, hex: color };
    this.#render(source);
  }

  // Marque un champ illisible : « Appliquer » attend qu'il le redevienne (ou qu'on change la couleur au carré, à la teinte ou dans un autre champ).
  #invalidate(field, withHint) {
    field.setAttribute('aria-invalid', 'true');
    if (withHint) this.#parts.fields.hint.textContent = this.#t('kit.color.hexHint');
    this.#setValid(false);
  }

  #setValid(valid) {
    if (valid === this.#valid) return;
    this.#valid = valid;
    if (this.#opts.onValidity) this.#opts.onValidity(valid);
  }

  // Tout redessiner d'après l'état, sauf le champ `source` que la personne est en train de taper.
  #render(source) {
    const { square, compare, fields } = this.#parts;
    const state = this.#state;
    const percent = n => Math.round(n * 100);
    square.area.style.setProperty('--hue', `hsl(${state.h}, 100%, 50%)`);
    square.thumb.style.setProperty('left', `${state.s * 100}%`);
    square.thumb.style.setProperty('top', `${(1 - state.v) * 100}%`);
    square.area.setAttribute('aria-valuenow', String(percent(state.s)));
    square.area.setAttribute('aria-valuetext', this.#t('kit.color.areaValue', { s: percent(state.s), v: percent(state.v) }));
    square.hue.value = String(Math.round(state.h));
    square.hue.setAttribute('aria-valuetext', `${Math.round(state.h)}°`);
    compare.after.chip.style.setProperty('background', state.hex);
    const rgb = ColorMath.toRgb(state.hex);
    if (source !== 'hex') fields.hex.value = state.hex.toUpperCase();
    for (const { key, input } of fields.channels) if (source !== 'channel') input.value = String(rgb[key]);
    for (const field of [fields.hex, ...fields.channels.map(channel => channel.input)]) field.removeAttribute('aria-invalid');
    fields.hint.textContent = '';
    this.#setValid(true);
  }
}

// ----- La fenêtre du kit : une seule, redessinée à chaque ouverture.
let win = null;
let buttons = null;
let session = null;
const kept = {}; // les rangées cochées à la dernière ouverture, reprises à la suivante : qui compose plusieurs couleurs de suite ne recoche pas à chaque fois

function ensureWindow() {
  if (win) return;
  win = ModalBase.create({ id: 'kit-color-modal', titleId: 'kit-color-title', size: 'md', boxClass: 'cp-dialog-box', onEscape: () => finish(false) });
  buttons = win.addButtons();
  buttons.cancel.addEventListener('click', () => finish(false));
  buttons.ok.addEventListener('click', apply);
}

function apply() {
  if (!buttons.ok.disabled) finish(true);
}

function finish(applied) {
  if (!session) return;
  const done = session;
  session = null;
  const result = { color: done.editor.color(), scopes: done.editor.scopes() };
  win.hide();
  if (applied && done.options.onApply) done.options.onApply(result);
  if (done.options.onClose) done.options.onClose();
}

// Ouvre la fenêtre. `initial` : la couleur de départ (#rrggbb), montrée face à la nouvelle ; sans elle, le bleu d'accent et pas de « Actuelle ». `scopes` : les rangées où garder la couleur. `onApply({ color, scopes })` :
// « Appliquer ». `onClose()` : la fenêtre s'est fermée, quelle que soit la sortie, après `onApply`.
function open(options = {}) {
  const t = options.t || I18n.t;
  ensureWindow();
  const editor = new ColorEditor({ t, initial: options.initial || null, scopes: options.scopes || [], kept, onValidity: valid => { buttons.ok.disabled = !valid; }, onSubmit: apply });
  session = { options, editor };
  win.title.textContent = t('kit.color.custom');
  buttons.cancel.textContent = t('kit.cancel');
  buttons.ok.textContent = t('kit.color.apply');
  buttons.ok.disabled = false;
  win.body.replaceChildren(editor.element);
  win.show(() => editor.element.querySelector('.cp-hex'));
  editor.focus();
  return true;
}

export const ColorDialog = { open };
