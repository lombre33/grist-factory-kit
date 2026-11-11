// La carte d'importation d'une app, écrite d'après sa liste (cahier 4.7) : chaque nom nu que le code importe (`@tiptap/core`, `prosemirror-model`…) pointe vers l'adresse exacte de sa version, celle de
// `dependencies`. Une version ne s'écrit donc qu'une fois, dans la liste ; la carte la reprend partout où elle la nomme (le paquet, ses sous-chemins, ses plages).
//   "gfs": { "carte": { "origine": "https://esm.sh",
//                       "fixes": { "kit/ambiance-message": "./kit/js/ambiance-message.js?v=8afa569" },                  des entrées que l'app écrit telles quelles (le kit, ses propres modules)
//                       "paquets": ["prosemirror-model", "@tiptap/core"],                                              les noms nus, dans l'ordre de la carte ; leur version est celle de `dependencies`
//                       "uniques": ["prosemirror-model"],                                                              ceux dont il ne doit exister qu'UNE instance (`*` d'esm.sh : ses propres dépendances restent à la carte)
//                       "sousChemins": { "@tiptap/pm": { "model": "prosemirror-model" } },                             les adresses absolues qu'un paquet importe de lui-même, ramenées à l'instance unique
//                       "plages": { "prosemirror-state": "^1.0.0" },                                                   les adresses à plage de versions que d'autres paquets d'esm.sh demandent
//                       "cible": "es2022" } }                                                                          la cible de construction d'esm.sh (es2022 par défaut)
// Une bibliothèque en deux copies dans la page se voit tard (ProseMirror : « Adding different instances of a keyed plugin », des touches qui plantent) : d'où `uniques`, et des sous-chemins ramenés à elle.
import { EXACT_VERSION_RE } from './primitives.mjs';

const isNames = value => Array.isArray(value) && value.every(name => typeof name === 'string' && name !== '');

function checkNames(spec, deps) {
  if (!isNames(spec.paquets) || spec.paquets.length === 0) throw new Error('gfs.carte.paquets : une liste de noms attendue');
  if (new Set(spec.paquets).size !== spec.paquets.length) throw new Error('gfs.carte.paquets : un nom est écrit deux fois');
  for (const name of spec.paquets) if (!EXACT_VERSION_RE.test(deps[name] || '')) throw new Error(`gfs.carte : la version de ${name} doit être exacte dans dependencies (reçu : ${deps[name]})`);
  if (!isNames(spec.uniques || [])) throw new Error('gfs.carte.uniques : une liste de noms attendue');
  for (const name of spec.uniques || []) if (!spec.paquets.includes(name)) throw new Error(`gfs.carte.uniques : ${name} n'est pas dans paquets`);
}

function checkRemaps(spec) {
  const unique = new Set(spec.uniques || []);
  for (const [paquet, subs] of Object.entries(spec.sousChemins || {})) {
    if (!spec.paquets.includes(paquet)) throw new Error(`gfs.carte.sousChemins : ${paquet} n'est pas dans paquets`);
    for (const [sub, target] of Object.entries(subs)) if (!unique.has(target)) throw new Error(`gfs.carte.sousChemins : ${paquet}/${sub} ramène à ${target}, qui n'est pas dans uniques`);
  }
  for (const name of Object.keys(spec.plages || {})) if (!unique.has(name)) throw new Error(`gfs.carte.plages : ${name} n'est pas dans uniques`);
}

// La déclaration de la carte, vérifiée ; `null` quand la liste n'en déclare pas (l'app n'a pas de carte à tenir).
export function readMap(packageJson) {
  const spec = packageJson.gfs && packageJson.gfs.carte;
  if (spec === undefined) return null;
  const deps = packageJson.dependencies || {};
  if (!/^https:\/\/[^/\s]+$/.test(spec.origine || '')) throw new Error('gfs.carte.origine : une origine https attendue (https://esm.sh)');
  checkNames(spec, deps);
  checkRemaps(spec);
  const fixes = spec.fixes || {};
  if (Object.values(fixes).some(value => typeof value !== 'string')) throw new Error('gfs.carte.fixes : des adresses attendues');
  return { origine: spec.origine, fixes, paquets: spec.paquets, uniques: new Set(spec.uniques || []), sousChemins: spec.sousChemins || {}, plages: spec.plages || {}, cible: spec.cible || 'es2022', deps };
}

// La carte : { imports } dans l'ordre, les entrées fixes, les paquets, les sous-chemins, les plages.
export function buildImportMap(map) {
  const address = name => `${map.origine}/${map.uniques.has(name) ? '*' : ''}${name}@${map.deps[name]}`;
  const imports = { ...map.fixes };
  for (const name of map.paquets) imports[name] = address(name);
  for (const [paquet, subs] of Object.entries(map.sousChemins)) {
    for (const [sub, target] of Object.entries(subs)) imports[`${map.origine}/${paquet}@${map.deps[paquet]}/${map.cible}/${sub}.mjs`] = address(target);
  }
  for (const [name, range] of Object.entries(map.plages)) imports[`${map.origine}/${name}@${range}?target=${map.cible}`] = address(name);
  return { imports };
}

// Le texte entre les balises, tel que l'outil l'écrit (et que la politique de sécurité en prend l'empreinte).
export const importMapText = map => `\n${JSON.stringify(buildImportMap(map), null, 2)}\n`;

export const blank = html => html.replace(/<!--[\s\S]*?-->/g, text => text.replace(/[^\n]/g, ' '));

// Où est le contenu de la balise `<script type="importmap">` de la page : { start, end }.
function spanOf(html) {
  const match = /<script\b[^>]*\btype\s*=\s*["']?importmap["']?[^>]*>([\s\S]*?)<\/script>/i.exec(blank(html));
  if (!match) throw new Error('la page n\'a pas de <script type="importmap"> : l\'écrire une fois à la main, vide (le reste, l\'outil le tient)');
  const start = match.index + match[0].indexOf('>') + 1;
  return { start, end: start + match[1].length };
}

// La page avec sa carte d'importation réécrite.
export function rewriteImportMap(html, text) {
  const { start, end } = spanOf(html);
  return `${html.slice(0, start)}${text}${html.slice(end)}`;
}

// Les écarts entre une carte présente (son texte) et celle de la liste : une entrée à ajouter, à retirer, à changer, ou un ordre ou une écriture que l'outil ne reconnaît pas. `label` dit quelle carte.
export function mapProblems(present, text, label = 'la carte d\'importation') {
  if (present === text) return [];
  let found;
  try { found = JSON.parse(present).imports || {}; } catch (error) { return [`${label} n'est pas du JSON : relancer l'outil`]; }
  const wanted = JSON.parse(text).imports;
  const problems = [
    ...Object.keys(wanted).filter(key => !(key in found)).map(key => `à ajouter à ${label} : ${key}`),
    ...Object.keys(found).filter(key => !(key in wanted)).map(key => `à retirer de ${label} : ${key}`),
    ...Object.keys(wanted).filter(key => key in found && found[key] !== wanted[key]).map(key => `à changer dans ${label} : ${key} vaut ${found[key]}, la liste dit ${wanted[key]}`),
  ];
  return problems.length ? problems : [`${label} n'est pas écrite comme l'outil l'écrit (ordre, espaces) : relancer l'outil`];
}

// Les écarts entre la carte de la page et celle de la liste.
export function checkImportMap(html, text) {
  const { start, end } = spanOf(html);
  return mapProblems(html.slice(start, end), text);
}

// Où est l'élément `<script type="importmap">` tout entier (les balises comprises) : { start, end }, ou null quand la page n'en a pas.
export function importMapElement(html) {
  const match = /<script\b[^>]*\btype\s*=\s*["']?importmap["']?[^>]*>[\s\S]*?<\/script>/i.exec(blank(html));
  return match ? { start: match.index, end: match.index + match[0].length } : null;
}
