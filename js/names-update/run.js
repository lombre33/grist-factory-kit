// L'enchaînement de la mise à jour des noms, sans fenêtre : préparer (qu'y a-t-il à faire, et la personne peut-elle le faire ?) puis exécuter (relire, envoyer un seul lot,
// vérifier). Toute la parole avec Grist passe par un `port` que l'app donne :
//   port.readSchema()   -> Promise<{ tables: { '<table>': ['<colonne>', …] }, shared?: […] }>   les noms du document maintenant
//   port.isOwner()      -> Promise<true | false | null>   null : preuve impossible (traité comme « non »)
//   port.readOnly?()    -> boolean | Promise<boolean>     la page ne peut pas écrire
//   port.apply(actions) -> Promise<void>                  UN lot atomique ; refus ou panne : promesse rejetée
//   port.rowCount?(table) -> Promise<number>              facultatif : les lignes comptées avant et après
// et d'une fonction `plan(schema)` -> actions | null : le lot de renommage de l'app d'après les noms du document (rien à faire : null ou liste vide).
// Aucun texte ici : les états sont des mots, la fenêtre (window.js) les dit. Rien n'est écrit dans la console.
import { syncTables, keepOut, summarize, check, applied, touched } from './plan.js';

export const DEFAULT_TIMEOUT_MS = 60000;

const errorText = error => String((error && error.message) || error || '').slice(0, 200);

// Les noms du document et le lot qui en découle, sans les tables que Sync+ utilise.
async function compute(port, plan) {
  const schema = await port.readSchema();
  const wanted = (await plan(schema)) || [];
  return { schema, ...keepOut(wanted, syncTables(schema)) };
}

async function mayWrite(port) {
  try {
    if (typeof port.readOnly === 'function' && await port.readOnly()) return false;
    return (await port.isOwner()) === true;
  } catch (error) { return false; }
}

// Que faut-il faire, et qui peut le faire ? `state` :
//   none     rien à renommer (ou seulement des tables que Sync+ garde) : l'app continue ;
//   wait     il y a à faire, mais cette personne ne peut pas (propriétaire non prouvé, lecture seule, schéma illisible) : pas de fenêtre, l'app continue sur les noms d'avant ;
//   blocked  il y a à faire, mais un nom d'arrivée est déjà pris ou une source manque : pas de fenêtre, l'app dit ce qu'elle veut (`taken`, `missing`) ;
//   ready    la fenêtre peut s'ouvrir.
export async function prepare({ port, plan }) {
  let now;
  try { now = await compute(port, plan); } catch (error) { return { state: 'wait', reason: 'unreadable', actions: [], held: [], detail: errorText(error) }; }
  const base = { actions: now.actions, held: now.held, summary: summarize(now.actions) };
  if (!now.actions.length) return { ...base, state: 'none' };
  if (!(await mayWrite(port))) return { ...base, state: 'wait', reason: 'rights' };
  const verdict = check(now.actions, now.schema);
  return verdict.ok ? { ...base, state: 'ready' } : { ...base, state: 'blocked', taken: verdict.taken, missing: verdict.missing };
}

// Le lot part d'un seul envoi ; au-delà du délai on cesse d'attendre sans savoir : la réponse peut encore arriver, c'est le schéma relu qui dira.
function send(port, actions, timeoutMs) {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve({ ok: false, timedOut: true }), timeoutMs);
    Promise.resolve().then(() => port.apply(actions)).then(
      () => { clearTimeout(timer); resolve({ ok: true }); },
      error => { clearTimeout(timer); resolve({ ok: false, error: errorText(error) }); });
  });
}

async function countRows(port, names) {
  if (typeof port.rowCount !== 'function') return null;
  try {
    const counts = [];
    for (const name of names) counts.push(Number(await port.rowCount(name)));
    return counts.some(count => !Number.isFinite(count)) ? null : counts;
  } catch (error) { return null; }
}

// Le schéma relu après l'envoi : null quand Grist ne répond pas.
const reread = async port => { try { return await port.readSchema(); } catch (error) { return null; } };

// Ce que l'envoi a donné, d'après les noms relus : fait (même si la réponse s'est perdue), refusé (rien n'a changé) ou inconnu (autre chose que prévu, ou délai passé).
function outcomeOf(sent, actions, schema, before) {
  if (schema && applied(actions, schema, before)) return 'done';
  if (sent.ok || sent.timedOut || !schema || !check(actions, schema).ok) return 'unknown';
  return 'refused';
}

// Les lignes avant et après, table par table : les noms d'après le lot, les mêmes nombres. `before` et `after` sont les comptes (ou null : non comptés).
function compare(pairs, before, after) {
  if (!before || !after) return { rows: null, mismatch: [] };
  const mismatch = pairs.filter((pair, at) => before[at] !== after[at]).map(pair => pair.after);
  return { rows: before.reduce((sum, count) => sum + count, 0), mismatch };
}

// Relit les noms (rien n'a changé depuis la fenêtre ?), envoie le lot, relit encore, vérifie. `state` : done (`tables`, `columns`, `rows` : le nombre de lignes vérifiées ou null,
// `mismatch` : les tables dont le nombre de lignes diffère), already (rien à refaire : un autre onglet est passé), blocked (un nom d'arrivée est pris : rien n'est envoyé), refused
// (Grist a refusé, rien n'a changé : `detail`), unknown (délai ou noms inattendus : `detail`).
export async function execute({ port, plan, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  let now;
  try { now = await compute(port, plan); } catch (error) { return { state: 'unknown', detail: errorText(error) }; }
  const { actions } = now;
  if (!actions.length) return { state: 'already' };
  const verdict = check(actions, now.schema);
  if (!verdict.ok) return { state: 'blocked', taken: verdict.taken, missing: verdict.missing };
  const pairs = touched(actions);
  const before = await countRows(port, pairs.map(pair => pair.before));
  const sent = await send(port, actions, timeoutMs);
  const schema = await reread(port);
  const state = outcomeOf(sent, actions, schema, now.schema);
  if (state !== 'done') return { state, detail: sent.error || '', timedOut: Boolean(sent.timedOut) };
  const { rows, mismatch } = compare(pairs, before, await countRows(port, pairs.map(pair => pair.after)));
  return { state: 'done', tables: pairs.length, columns: summarize(actions).columns, rows, mismatch };
}
