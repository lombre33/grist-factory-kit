// Un document Grist minimal pour essayer la mise à jour des noms, avec les comportements mesurés dans un vrai Grist (faits vérifiés de GFS, 158) : le lot est atomique (une action
// qui échoue annule tout), une source absente est refusée, et un nom d'arrivée déjà pris N'EST PAS refusé : Grist ajoute « 2 » et répond 200.
//   const doc = fakeDoc({ Modeles: { columns: ['Nom', 'Jeton'], rows: 5 } }, { owner: true, delayMs: 0 });   doc.port, doc.tables(), doc.applied (les lots reçus)
// `delayMs` : l'attente de Grist avant d'appliquer le lot (pour voir la fenêtre « en cours »). Sans API de Node : la page d'essai du navigateur l'importe aussi.
const lower = value => String(value).toLowerCase();

function free(names, wanted) {
  let name = wanted;
  for (let n = 2; names.has(lower(name)); n++) name = `${wanted}${n}`;
  return name;
}

// Joue le lot sur une copie ; rend la copie, ou lève comme Grist (rien n'est changé alors).
function play(tables, actions) {
  const next = new Map([...tables].map(([key, value]) => [key, { id: value.id, columns: [...value.columns], rows: value.rows }]));
  for (const [verb, first, second, third] of actions) {
    const entry = next.get(lower(first));
    if (!entry) throw new Error(`Table not found "${first}"`);
    if (verb === 'RenameTable') {
      next.delete(lower(first));
      const id = free(new Set(next.keys()), second);
      next.set(lower(id), { ...entry, id });
    } else {
      const at = entry.columns.findIndex(column => lower(column) === lower(second));
      if (at < 0) throw new Error(`Invalid column "${first}.${second}"`);
      if (verb === 'RenameColumn') {
        const taken = new Set(entry.columns.filter((column, index) => index !== at).map(lower));
        entry.columns[at] = free(taken, third);
      }
    }
  }
  return next;
}

export function fakeDoc(initial, { owner = true, readOnly = false, delayMs = 0 } = {}) {
  let tables = new Map(Object.entries(initial).map(([id, value]) => [lower(id), { id, columns: [...value.columns], rows: value.rows ?? 0 }]));
  const doc = {
    applied: [],
    reads: 0,
    ownerChecks: 0,
    // Ce que le document fait au prochain `apply`, pour les cas de panne : { refuse: 'texte' } (403, rien n'est changé), { lose: true } (le lot passe, la réponse se perd),
    // { hang: true } (jamais de réponse, le lot ne passe pas), { race: ['Nom'] } (une table de ce nom apparaît juste avant), { loseRows: 'Nom' } (une ligne disparaît : ne doit jamais arriver).
    next: null,
    tables: () => Object.fromEntries([...tables.values()].map(entry => [entry.id, [...entry.columns]])),
    rows: id => tables.get(lower(id))?.rows,
    add(id, columns, rows = 0) { tables.set(lower(id), { id, columns: [...columns], rows }); },
    port: {
      readSchema: async () => { doc.reads++; return { tables: doc.tables() }; },
      isOwner: async () => { doc.ownerChecks++; return owner; },
      readOnly: async () => readOnly,
      rowCount: async id => {
        const entry = tables.get(lower(id));
        if (!entry) throw new Error(`Table not found "${id}"`);
        return entry.rows;
      },
      apply: async actions => {
        doc.applied.push(actions);
        if (delayMs) await new Promise(resolve => setTimeout(resolve, delayMs));
        const mode = doc.next;
        doc.next = null;
        if (mode && mode.refuse) throw new Error(mode.refuse);
        if (mode && mode.hang) return new Promise(() => {});
        if (mode && mode.race) mode.race.forEach(id => doc.add(id, ['A'], 0));
        tables = play(tables, actions);
        if (mode && mode.loseRows) tables.get(lower(mode.loseRows)).rows -= 1;
        if (mode && mode.lose) throw new Error('network down');
      },
    },
  };
  return doc;
}
