// Le noyau de la mise à jour des noms (sans fenêtre, sans Grist) : ce que l'app veut renommer, ce qu'il faut laisser, ce qui bloquerait. L'app calcule son lot (`RenameTable`,
// `RenameColumn`, `ModifyColumn` du libellé seul) ; le kit le juge, avec le schéma que l'app lui donne :
//   schéma = { tables: { '<table>': ['<colonne>', …], … }, shared?: ['<table>', …] }   (les identifiants du document, tels que Grist les nomme maintenant ; `shared` : les tables
//   que l'app sait utilisées par un partage Sync+ et que ses colonnes ne disent pas, par exemple lues dans la table `Synchro`)
// Grist ne distingue pas les capitales : tout se compare en minuscules. Aucune écriture ici, aucun texte.

const lower = value => String(value ?? '').toLowerCase();

// La colonne que Sync+ pose sur toute table qu'il envoie ou qu'il reçoit : un nom du protocole entre deux documents, qui ne change pas (js/synchro/logic/common.js, `KEY_COL`).
export const SYNC_KEY = 'id_sync';

// Les tables que Sync+ utilise : celles qui portent sa colonne (et celles que l'app dit partagées). Renommée, une table rend le lien muet et une colonne le fait envoyer des
// cellules vides (faits vérifiés de GFS, 160). La colonne se lit dans les métadonnées de Grist, que tout le monde lit : pas besoin d'être propriétaire pour le savoir (la table
// `Synchro`, elle, est réservée aux propriétaires).
export function syncTables(schema) {
  const used = new Set(((schema && schema.shared) || []).map(lower));
  for (const [table, columns] of Object.entries((schema && schema.tables) || {})) {
    if ((columns || []).some(column => lower(column) === SYNC_KEY)) used.add(lower(table));
  }
  return used;
}

// Les tables qu'une action vise : `RenameTable` nomme l'ancienne et la nouvelle, les autres une seule.
const tablesOf = action => (action[0] === 'RenameTable' ? [action[1], action[2]] : [action[1]]);

// Le lot sans tout ce qui touche aux tables à laisser : leur renommage, celui de leurs colonnes et leurs libellés, que l'action les nomme par l'ancien nom ou par le nouveau (un lot
// écrit ses colonnes d'après les noms de tables d'après le renommage). `held` : ces tables sous leur nom d'avant, triées.
export function keepOut(actions, keep) {
  const out = new Set(keep);
  for (const action of actions) {
    if (action[0] === 'RenameTable' && tablesOf(action).some(name => out.has(lower(name)))) tablesOf(action).forEach(name => out.add(lower(name)));
  }
  const held = new Set();
  for (const action of actions) for (const name of tablesOf(action)) if (keep.has(lower(name))) held.add(name);
  return { actions: actions.filter(action => !tablesOf(action).some(name => out.has(lower(name)))), held: [...held].sort((a, b) => a.localeCompare(b)) };
}

// Ce que le lot change, pour le dire : les paires de tables, le nombre de colonnes renommées, de libellés changés.
export function summarize(actions) {
  return {
    tables: actions.filter(action => action[0] === 'RenameTable').map(action => [action[1], action[2]]),
    columns: actions.filter(action => action[0] === 'RenameColumn').length,
    labels: actions.filter(action => action[0] === 'ModifyColumn').length,
  };
}

// Les tables que le lot touche, chacune avec son nom d'avant et son nom d'après (le même quand seules ses colonnes changent) : ce dont on compte les lignes avant et après.
export function touched(actions) {
  const pairs = actions.filter(action => action[0] === 'RenameTable').map(action => ({ before: action[1], after: action[2] }));
  const known = new Set(pairs.flatMap(pair => [lower(pair.before), lower(pair.after)]));
  for (const action of actions) {
    if (action[0] !== 'RenameTable' && !known.has(lower(action[1]))) { known.add(lower(action[1])); pairs.push({ before: action[1], after: action[1] }); }
  }
  return pairs;
}

const copyOf = schema => new Map(Object.entries((schema && schema.tables) || {}).map(([table, columns]) => [lower(table), { id: table, columns: new Set((columns || []).map(lower)) }]));

// Le lot rejoué sur une copie du schéma, action après action : un nom d'arrivée déjà pris (Grist ne refuse pas, il ajoute « 2 » : faits vérifiés de GFS, 158) ou une source qui n'existe
// plus (un autre onglet est passé avant, ou le lot a été calculé sur de vieux noms).
export function check(actions, schema) {
  const tables = copyOf(schema);
  const taken = [];
  const missing = [];
  for (const [verb, first, second, third] of actions) {
    const entry = tables.get(lower(first));
    if (verb === 'RenameTable') {
      if (!entry) missing.push(first);
      else if (lower(first) !== lower(second) && tables.has(lower(second))) taken.push(second);
      else { tables.delete(lower(first)); tables.set(lower(second), { ...entry, id: second }); }
    } else if (!entry || !entry.columns.has(lower(second))) missing.push(`${first}.${second}`);
    else if (verb === 'RenameColumn') {
      if (lower(second) !== lower(third) && entry.columns.has(lower(third))) taken.push(`${first}.${third}`);
      else { entry.columns.delete(lower(second)); entry.columns.add(lower(third)); }
    }
  }
  return { ok: !taken.length && !missing.length, taken, missing };
}

// Un nom que Grist a ajouté par-dessus : « Nom2 » quand « Nom » était pris (faits vérifiés de GFS, 158), absent du schéma d'avant.
const suffixed = (name, now, before) => [...now].some(other => other !== name && other.startsWith(name) && /^\d+$/.test(other.slice(name.length)) && !before.has(other));

// Le lot a-t-il été appliqué ? Chaque nom d'arrivée est là, chaque nom de départ n'y est plus, et Grist n'a rien ajouté « 2 » à un nom d'arrivée qu'un autre avait pris entre-temps.
// Lu sur un schéma neuf après l'envoi : c'est ce qui dit la vérité quand la réponse de Grist s'est perdue en route (le lot est atomique : tout est passé ou rien ne l'est). `before` :
// le schéma d'avant l'envoi.
export function applied(actions, schema, before) {
  const tables = copyOf(schema);
  const old = copyOf(before);
  const renamed = new Map(actions.filter(action => action[0] === 'RenameTable').map(action => [lower(action[1]), action[2]]));
  return actions.every(([verb, first, second, third]) => {
    if (verb === 'RenameTable') {
      return tables.has(lower(second)) && (lower(first) === lower(second) || !tables.has(lower(first))) && !suffixed(lower(second), tables.keys(), new Set(old.keys()));
    }
    const entry = tables.get(lower(renamed.get(lower(first)) || first));
    if (!entry) return false;
    if (verb !== 'RenameColumn') return entry.columns.has(lower(second));
    const was = old.get(lower(first)) || old.get(lower(renamed.get(lower(first)) || first));
    return entry.columns.has(lower(third)) && (lower(second) === lower(third) || !entry.columns.has(lower(second))) && !suffixed(lower(third), entry.columns, was ? was.columns : new Set());
  });
}
