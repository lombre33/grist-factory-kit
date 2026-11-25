// La fenêtre de mise à jour des noms : commune à toutes les apps (base du kit, js/modal-base.js), BLOQUANTE : ni « Annuler », ni Échap, ni clic sur le voile avant que la mise à jour soit
// faite ou refusée. Elle ne s'ouvre que pour qui peut la faire (js/names-update/run.js, `prepare`) et dit ce qu'elle fait : les données ne changent pas, seuls les noms. Après un refus,
// « Continuer sans mettre à jour » rend la main à l'app, qui continue sur les noms d'avant (elle lit les deux jeux).
//   showUpdateWindow({ appName, prepared, run }) -> Promise<{ state: 'done' | 'already' | 'skipped', result }>
//     prepared : ce que `prepare` a rendu (état « ready ») ; run : () => Promise<résultat de `execute`>. Rend quand la personne a cliqué sur « Continuer ».
import { h } from '../dom.js';
import { I18n } from '../i18n.js';
import { ModalBase } from '../modal-base.js';
import { once } from '../once.js';
import { NAMES_STRINGS } from './strings.js';

once('names-update-window', import.meta.url);
I18n.add(NAMES_STRINGS);

const MAX_PAIRS = 5;
const t = (key, vars) => I18n.t(`kit.names.${key}`, vars);
const paragraph = (text, className) => h('p', { class: className ? `nu-text ${className}` : 'nu-text' }, text);

// Ce que la fenêtre dit avant le clic, le plus important en haut (rien n'est perdu, rien n'est long, ce qui change pour la personne), puis ce qui reste (Sync+) et, sous un titre qu'on
// ouvre, la liste des noms (les cinq premières paires, le reste en un mot) : elle serait sinon la plus longue chose de la fenêtre et pousserait le plus important sous le pli.
function introduction(appName, prepared) {
  const { tables, columns } = prepared.summary;
  const pairs = tables.slice(0, MAX_PAIRS).map(([from, to]) => h('li', {}, h('code', {}, from), h('span', { class: 'nu-becomes' }, t('becomes')), h('code', {}, to)));
  if (tables.length > MAX_PAIRS) pairs.push(h('li', { class: 'nu-more' }, t('more', { n: tables.length - MAX_PAIRS })));
  const heading = t('list', { tables: tables.length, columns });
  // `tabindex` : la base des fenêtres ne met dans le tour de Tab que ce qu'elle reconnaît (js/modal-base.js), et le titre d'un bloc qu'on ouvre n'en fait pas partie.
  const list = pairs.length ? h('details', { class: 'nu-details' }, h('summary', { tabindex: 0 }, heading), h('ul', { class: 'nu-pairs' }, pairs)) : paragraph(heading, 'nu-muted');
  return [
    paragraph(t('intro', { app: appName })),
    paragraph(t('quick'), 'nu-strong'),
    paragraph(t('follow')),
    prepared.held.length ? paragraph(t('held', { n: prepared.held.length, names: prepared.held.join(', ') }), 'nu-held') : null,
    list,
  ];
}

// Le texte d'un résultat et ses boutons : { nodes, label (clé du bouton principal), retry (le bouton principal relance la mise à jour), skip (clé du bouton « sans mettre à jour », ou null) }.
function describe(result) {
  const detail = result.detail ? paragraph(t('detail', { detail: result.detail }), 'nu-muted') : null;
  if (result.state === 'done') {
    const sentence = result.rows === null ? t('doneNoCount', { tables: result.tables }) : t('done', { tables: result.tables, rows: result.rows });
    const warning = result.mismatch.length ? paragraph(t('mismatch', { names: result.mismatch.join(', ') }), 'nu-alert') : null;
    return { nodes: [paragraph(sentence, 'nu-ok'), warning], label: 'continue', retry: false, skip: null };
  }
  if (result.state === 'already') return { nodes: [paragraph(t('already'), 'nu-ok')], label: 'continue', retry: false, skip: null };
  if (result.state === 'blocked') {
    return { nodes: [paragraph(t('blocked', { names: [...result.taken, ...result.missing].join(', ') }), 'nu-alert')], label: 'continue', retry: false, skip: null };
  }
  if (result.state === 'refused') return { nodes: [paragraph(t('refused'), 'nu-alert'), detail], label: 'retry', retry: true, skip: 'skip' };
  return { nodes: [paragraph(t('unknown'), 'nu-alert'), detail], label: 'check', retry: true, skip: 'skip' };
}

export function showUpdateWindow({ appName, prepared, run }) {
  return new Promise(resolve => {
    let phase = 'ready'; // ready, working, puis result (describe() dit les boutons)
    let shown = null;
    // Échap ne ferme que ce qui est fini : jamais avant le clic, jamais pendant la mise à jour ; après un refus, il vaut « Continuer sans mettre à jour ».
    const win = ModalBase.create({ id: 'nu-modal', titleId: 'nu-title', size: 'md', boxClass: 'nu-box', onEscape: () => { if (phase === 'result') leave(shown.skip ? 'skipped' : shown.result.state); } });
    const body = h('div', { class: 'nu-body', 'aria-live': 'polite' });
    win.body.append(body);
    win.title.textContent = t('title');
    const { cancel, ok } = win.addButtons();

    function leave(state) {
      win.hide();
      win.overlay.remove();
      resolve({ state, result: shown ? shown.result : null });
    }
    function render(nodes, { label, skip, busy }) {
      body.replaceChildren(...nodes.filter(Boolean));
      cancel.hidden = !skip;
      if (skip) cancel.textContent = t(skip);
      ok.textContent = t(label);
      ok.disabled = Boolean(busy);
    }
    async function start() {
      phase = 'working';
      render([paragraph(t('workingText'))], { label: 'working', busy: true });
      win.box.focus();
      let result;
      try { result = await run(); } catch (error) { result = { state: 'unknown', detail: String((error && error.message) || error).slice(0, 200) }; }
      shown = { ...describe(result), result };
      phase = 'result';
      render(shown.nodes, shown);
      win.show(() => ok);
    }

    cancel.addEventListener('click', () => { if (phase === 'result' && shown.skip) leave('skipped'); });
    ok.addEventListener('click', () => {
      if (phase === 'ready' || (phase === 'result' && shown.retry)) start();
      else if (phase === 'result') leave(shown.result.state);
    });
    render(introduction(appName, prepared), { label: 'start' });
    win.show(() => ok);
  });
}
