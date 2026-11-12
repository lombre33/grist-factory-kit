// Les correcteurs du navigateur coupés chez l'app (contrats de GFS 5.2, point 13) : le message `{ coupes }` lu avec méfiance (js/correcteurs-message.js) et la marque `data-lt-active="false"` posée sur
// chaque zone de texte (js/correcteurs-pose.js, branché sur le lien du kit par js/correcteurs.js). Ici, une page de poche (des éléments, un `MutationObserver`) : que LanguageTool obéisse à la marque
// est la mesure du porteur de GFS (12/11, faits vérifiés de GFS 104), et ce que GFS envoie vraiment se mesure dans son labo (`run-correcteurs.mjs`), avec une app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCorrecteurs } from '../js/correcteurs-message.js';
import { MARK, CANDIDATES, MARKED, isEditable, createCorrecteurs } from '../js/correcteurs-pose.js';
import { Correcteurs } from '../js/correcteurs.js';

// ---------- une page de poche : des éléments, des observateurs qui reçoivent ce que le navigateur leur dirait ----------
function page() {
  const observers = new Set();
  const deliver = record => {
    for (const observer of observers) {
      const { options } = observer;
      if (record.type === 'childList' && options.childList) observer.callback([record]);
      if (record.type === 'attributes' && options.attributes && options.attributeFilter.includes(record.attributeName)) observer.callback([record]);
    }
  };
  const el = (tag, attrs = {}, children = []) => {
    const node = {
      nodeType: 1, tagName: tag.toUpperCase(), attrs: new Map(Object.entries(attrs)), children: [],
      getAttribute(name) { return this.attrs.has(name) ? this.attrs.get(name) : null; },
      setAttribute(name, value) { this.attrs.set(name, String(value)); deliver({ type: 'attributes', target: this, attributeName: name }); },
      removeAttribute(name) { this.attrs.delete(name); },
      append(child) { this.children.push(child); deliver({ type: 'childList', target: this, addedNodes: [child] }); },
      descendants() { return this.children.filter(child => child.nodeType === 1).flatMap(child => [child, ...child.descendants()]); },
      querySelectorAll(selector) {
        if (selector === CANDIDATES) return this.descendants().filter(node => ['TEXTAREA', 'INPUT'].includes(node.tagName) || node.attrs.has('contenteditable'));
        if (selector === MARKED) return this.descendants().filter(node => node.attrs.get(MARK) === 'false');
        throw new Error(`sélecteur inconnu : ${selector}`);
      },
    };
    node.children = children;
    return node;
  };
  class MutationObserver {
    constructor(callback) { this.callback = callback; }
    observe(target, options) { this.options = options; observers.add(this); }
    disconnect() { observers.delete(this); }
  }
  const root = el('html');
  return { el, root, observers, doc: { documentElement: root }, win: { MutationObserver } };
}

// Le lien de poche : `{ correcteurs(), onCorrecteurs(fn), ready }`, et `say(coupes)` rappelle les abonnés comme le fait GfsLink.
function fakeLink(coupes = false, ready = Promise.resolve()) {
  const state = { coupes };
  const listeners = new Set();
  return {
    ready, correcteurs: () => ({ ...state }), onCorrecteurs: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    say(value) { state.coupes = value; for (const fn of [...listeners]) fn({ ...state }); }, listeners,
  };
}

const marked = node => node.getAttribute(MARK);

test('le message : tout ce qui n\'est pas exactement { coupes: true } vaut « pas coupé »', () => {
  assert.deepEqual(normalizeCorrecteurs({ coupes: true }), { coupes: true });
  assert.deepEqual(normalizeCorrecteurs({ coupes: false }), { coupes: false });
  for (const raw of [undefined, null, 'oui', 1, true, [], [true], {}, { coupes: 'true' }, { coupes: 1 }, { coupes: null }]) assert.deepEqual(normalizeCorrecteurs(raw), { coupes: false }, JSON.stringify(raw));
});

test('une zone de texte : textarea, input de texte, contenteditable qui ne dit pas « false » ; ni un mot de passe, ni une case, ni un conteneur', () => {
  const { el } = page();
  for (const node of [el('textarea'), el('input'), el('input', { type: 'text' }), el('input', { type: 'SEARCH' }), el('input', { type: 'email' }), el('input', { type: 'url' }), el('input', { type: 'tel' }),
    el('div', { contenteditable: 'true' }), el('div', { contenteditable: '' }), el('div', { contenteditable: 'plaintext-only' }), el('div', { contenteditable: ' True ' })]) assert.equal(isEditable(node), true, node.tagName);
  for (const node of [el('div'), el('section', { class: 'editor' }), el('input', { type: 'password' }), el('input', { type: 'checkbox' }), el('input', { type: 'number' }), el('input', { type: 'hidden' }),
    el('input', { type: 'file' }), el('div', { contenteditable: 'false' }), el('div', { contenteditable: 'inherit' }), null, undefined, { nodeType: 3 }]) assert.equal(isEditable(node), false, String(node && node.tagName));
});

test('coupé dès le départ : chaque zone de texte de la page porte la marque, elle-même, jamais le conteneur qui l\'entoure', () => {
  const { el, root, doc, win } = page();
  const editor = el('div', { contenteditable: 'true' });
  const wrap = el('div', { class: 'editor-wrap' }, [editor]);
  const area = el('textarea');
  const field = el('input', { type: 'text' });
  const password = el('input', { type: 'password' });
  const badge = el('span', { contenteditable: 'false' });
  root.children.push(wrap, area, field, password, badge);
  createCorrecteurs({ link: fakeLink(true), doc, win }).start();
  assert.deepEqual([editor, area, field].map(marked), ['false', 'false', 'false']);
  assert.deepEqual([wrap, password, badge, root].map(marked), [null, null, null, null], 'ni le conteneur, ni un mot de passe, ni ce qui n\'est pas éditable');
});

test('pas coupé : rien n\'est posé, aucun observateur n\'existe (zéro coût tant que la personne n\'a rien coupé)', () => {
  const { el, root, doc, win, observers } = page();
  const area = el('textarea');
  root.children.push(area);
  createCorrecteurs({ link: fakeLink(false), doc, win }).start();
  assert.equal(marked(area), null);
  assert.equal(observers.size, 0);
  root.append(el('textarea'));
  assert.equal(marked(root.children.at(-1)), null);
});

test('les zones qui naissent ensuite sont marquées à l\'arrivée : un nœud ajouté et ses descendants, un contenteditable qui devient vrai, un type qui devient du texte', () => {
  const { el, root, doc, win } = page();
  createCorrecteurs({ link: fakeLink(true), doc, win }).start();
  const inner = el('textarea');
  const fieldEditor = el('div', { contenteditable: 'true' });
  const dialog = el('div', { class: 'dialog' }, [el('p'), inner, el('div', {}, [fieldEditor])]);
  root.append(dialog);
  assert.deepEqual([inner, fieldEditor, dialog].map(marked), ['false', 'false', null], 'le nœud ajouté est lu avec tout ce qu\'il porte');
  const cell = el('div', { contenteditable: 'false' });
  root.append(cell);
  assert.equal(marked(cell), null);
  cell.setAttribute('contenteditable', 'true');
  assert.equal(marked(cell), 'false', 'une cellule qui s\'ouvre à l\'édition');
  const secret = el('input', { type: 'password' });
  root.append(secret);
  assert.equal(marked(secret), null);
  secret.setAttribute('type', 'text');
  assert.equal(marked(secret), 'false', 'un champ qui devient du texte');
  const text = { nodeType: 3 };
  assert.doesNotThrow(() => root.append(text), 'un nœud de texte ajouté ne fait rien');
});

test('rallumé : GFS dit « pas coupé », les marques posées par le kit partent, celle que l\'app avait posée elle-même reste, et l\'observateur s\'en va', () => {
  const { el, root, doc, win, observers } = page();
  const mine = el('textarea', { [MARK]: 'false' });
  const other = el('div', { contenteditable: 'true' });
  const link = fakeLink(true);
  root.children.push(mine, other);
  createCorrecteurs({ link, doc, win }).start();
  assert.equal(observers.size, 1);
  assert.deepEqual([marked(mine), marked(other)], ['false', 'false']);
  link.say(false);
  assert.equal(marked(other), null, 'la marque du kit est retirée');
  assert.equal(marked(mine), 'false', 'celle de l\'app n\'est jamais retirée par le kit');
  assert.equal(observers.size, 0);
  link.say(true);
  assert.equal(marked(other), 'false', 'recoupé : la marque revient');
  assert.equal(observers.size, 1);
});

test('une marque que l\'app a posée elle-même, même sur une zone qui naît après, n\'est pas reprise par le kit', () => {
  const { el, root, doc, win } = page();
  const link = fakeLink(true);
  createCorrecteurs({ link, doc, win }).start();
  const mine = el('textarea', { [MARK]: 'false' });
  root.append(mine);
  link.say(false);
  assert.equal(marked(mine), 'false');
});

test('le contexte de GFS arrive après le démarrage : la marque est posée à ce moment-là (`ready`), l\'app n\'a rien à refaire', async () => {
  const { el, root, doc, win } = page();
  const area = el('textarea');
  root.children.push(area);
  let arrive;
  const link = fakeLink(false, new Promise(resolve => { arrive = resolve; }));
  const posed = createCorrecteurs({ link, doc, win }).start();
  assert.equal(marked(area), null);
  link.say(true);
  assert.equal(marked(area), 'false', 'l\'événement ou le contexte suffit');
  link.say(false);
  arrive();
  await posed.ready;
  assert.equal(marked(area), null);
});

test('`refresh` repasse tout ; `stop` retire les marques posées, se désabonne et rend la main ; `start` deux fois rend le même', () => {
  const { el, root, doc, win, observers } = page();
  const area = el('textarea');
  root.children.push(area);
  const link = fakeLink(true);
  const pose = createCorrecteurs({ link, doc, win });
  const first = pose.start();
  assert.equal(pose.start(), first);
  area.removeAttribute(MARK);
  first.refresh();
  assert.equal(marked(area), 'false');
  first.stop();
  assert.equal(marked(area), null);
  assert.equal(observers.size, 0);
  assert.equal(link.listeners.size, 0);
  link.say(true);
  assert.equal(marked(area), null, 'arrêté : GFS n\'est plus suivi');
  const second = pose.start();
  assert.notEqual(second, first);
  assert.equal(marked(area), 'false', 'redémarré : la marque revient');
});

test('sans lien qui sache les correcteurs, la pose le dit au lieu de ne rien faire', () => {
  for (const link of [undefined, null, {}, { correcteurs: () => ({}) }, { onCorrecteurs: () => () => {} }]) assert.throws(() => createCorrecteurs({ link }), TypeError);
});

test('`Correcteurs` est la pose branchée sur le lien du kit, au démarrage de l\'app', () => {
  assert.equal(typeof Correcteurs.start, 'function');
});
