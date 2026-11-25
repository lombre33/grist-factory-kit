// Point d'entrée de la mise à jour des noms (module facultatif du kit : une app qui n'en veut pas ne le charge pas). Une app qui change les noms de ses tables ou de ses colonnes ne les
// renomme jamais en silence : elle appelle `NamesUpdate.run`, qui décide s'il y a quelque chose à faire, si cette personne peut le faire, affiche la fenêtre commune et vérifie le résultat.
//   const outcome = await NamesUpdate.run({ port, plan, appName });
//     port : voir js/names-update/run.js (readSchema, isOwner, readOnly, apply, rowCount facultatif) ; plan(schema) -> le lot de l'app (RenameTable, RenameColumn, ModifyColumn du libellé).
//     outcome.state : none (rien à faire) · wait (cette personne ne peut pas : l'app continue sur les noms d'avant, sans rien montrer) · blocked (un nom d'arrivée est déjà pris : l'app
//     a les deux jeux de noms, c'est à elle de les réunir) · done · already · skipped (refus, puis « Continuer sans mettre à jour »). `held` : les tables gardées parce que Sync+ s'en sert.
// Le noyau (js/names-update/plan.js et run.js) ne touche ni au document ni à la page : il se teste seul, et GFS l'importe sans la fenêtre si besoin.
import { prepare, execute } from './run.js';
import { showUpdateWindow } from './window.js';
import { syncTables, keepOut, summarize, check, applied, SYNC_KEY } from './plan.js';

export { prepare, execute, syncTables, keepOut, summarize, check, applied, SYNC_KEY };

let running = null; // une seule mise à jour à la fois dans une page : un second appel reçoit la même réponse

async function runOnce({ port, plan, appName, timeoutMs }) {
  const prepared = await prepare({ port, plan });
  const outcome = { state: prepared.state, held: prepared.held, reason: prepared.reason || null, taken: prepared.taken || [], missing: prepared.missing || [], result: null };
  if (prepared.state !== 'ready') return outcome;
  const shown = await showUpdateWindow({ appName, prepared, run: () => execute({ port, plan, timeoutMs }) });
  return { ...outcome, state: shown.state, result: shown.result };
}

export function run(options) {
  if (!running) running = runOnce(options).finally(() => { running = null; });
  return running;
}

export const NamesUpdate = { run, prepare, execute };
