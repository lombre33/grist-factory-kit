// La page d'essai de la mise à jour des noms : une app qui s'ouvre sur un document aux noms d'avant et appelle `NamesUpdate.run`, comme le fait une vraie app. Le document est le faux de
// test/names-update-fake.mjs (il se comporte comme le vrai Grist, mesuré : lot atomique, nom pris = suffixe « 2 »). Le cas se choisit dans l'adresse : ?case=… (voir `CASES`).
import { I18n } from '../js/i18n.js';
import { Theme } from '../js/theme.js';
import { NamesUpdate } from '../js/names-update/index.js';
import { fakeDoc } from '../test/names-update-fake.mjs';

Theme.init({ storageKey: 'kit_theme' });
I18n.init({ storageKey: 'kit_lang' });

const PAIRS = [
  ['Publipostage_Modeles', 'Publipostage_Templates'], ['Publipostage_PreferencesModeles', 'Publipostage_TemplatePreferences'], ['Publipostage_LiensTables', 'Publipostage_TableLinks'],
  ['Publipostage_Dossiers', 'Publipostage_Folders'], ['Publipostage_Jetons', 'Publipostage_Tokens'], ['Publipostage_Journal', 'Publipostage_Log'], ['Publipostage_Reglages', 'Publipostage_Settings'],
];
// Le lot de l'app, recalculé d'après les noms du document : chaque table d'avant vers son nom anglais, et la colonne « Nom » de la première.
function plan(schema) {
  const names = new Set(Object.keys(schema.tables));
  const actions = [];
  for (const [from, to] of PAIRS) {
    if (!names.has(from)) continue;
    actions.push(['RenameTable', from, to]);
    if (from === PAIRS[0][0]) actions.push(['RenameColumn', to, 'Nom', 'Name'], ['ModifyColumn', to, 'Name', { label: 'Name' }]);
  }
  return actions.length ? actions : null;
}

// ready : 7 tables · few : 2 tables · sync : une table d'avant que Sync+ utilise · refuse : Grist refuse le premier lot · slow : Grist met 1,5 s · lost : la réponse se perd ·
// hang : pas de réponse · viewer : pas propriétaire · none : déjà aux noms anglais · both : les deux jeux de noms
const CASES = {
  ready: { count: 7 }, few: { count: 2 }, sync: { count: 3, sync: true }, refuse: { count: 3, next: { refuse: 'Blocked by table structure access rules' } },
  slow: { count: 3, delayMs: 1500 }, lost: { count: 3, next: { lose: true } }, hang: { count: 3, next: { hang: true } }, viewer: { count: 3, owner: false }, none: { count: 0 }, both: { count: 3, both: true },
};
const options = CASES[new URLSearchParams(location.search).get('case')] || CASES.ready;
const initial = {};
PAIRS.slice(0, options.count).forEach(([from], at) => { initial[from] = { columns: ['Nom', 'Jeton'], rows: 5 + at }; });
initial.Clients = { columns: ['Nom', 'Ville'], rows: 40 };
if (options.sync) initial[PAIRS[0][0]].columns.push('id_sync', 'MajLe');
if (options.both) initial[PAIRS[0][1]] = { columns: ['Name'], rows: 1 };
const doc = fakeDoc(initial, { owner: options.owner, delayMs: options.delayMs });
doc.next = options.next || null;

window.kit = { I18n, doc, outcome: null, plan };
const state = document.getElementById('state');
NamesUpdate.run({ port: doc.port, plan, appName: 'Publipostage+', timeoutMs: options.next && options.next.hang ? 800 : undefined }).then(outcome => {
  window.kit.outcome = outcome;
  state.textContent = `Mise à jour : ${outcome.state}`;
});
