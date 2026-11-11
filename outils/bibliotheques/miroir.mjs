// Le miroir des essais d'une app, refait d'après sa liste (cahier 4.7). Les essais d'une app tournent là où les CDN sont fermés (un environnement d'exécution distant, une intégration continue) : le miroir
// télécharge les mêmes versions exactes depuis npm et les range là où les essais attendent les adresses des CDN. Il n'est jamais commité ; la liste dit tout, rien n'est écrit à la main à côté.
//   "gfs": { "miroir": { "dossier": "dev-tests/.offline-cache",                       où poser le miroir
//                        "prefixe": "/dev-tests/.offline-cache/esm/",                  l'adresse, vue de la page d'essai, des modules ES (esm-map.json)
//                        "sansEsm": ["@tiptap/pm"],                                    des paquets de la carte que les essais n'importent jamais par leur nom (pas de module à construire)
//                        "supplementaires": [ { "paquet": "jsqr", "depuis": "dist/jsQR.js", "vers": "umd/jsqr.js" } ] },     des fichiers que seuls les essais lisent
//            "bibliotheques": { "marked": { "paquet": "marked", "src": "…", "miroir": { "depuis": "marked.min.js", "vers": "umd/marked.min.js" } } } }   le fichier du paquet que le miroir sert à la place du CDN
// Un fichier d'un paquet npm servi par jsDelivr (`fichier`) est celui que le miroir copie (`depuis` vaut `fichier` par défaut) ; un fichier d'un autre CDN dit le sien. Les modules ES de la carte sont construits
// d'un seul tenant (`splitting`) : sans lui, chaque module emporterait sa copie de ProseMirror, et deux copies dans une page cassent TipTap. `esbuild` se lit dans `devDependencies` de la liste, et du miroir.
import { copyFileSync, mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { isPackagePath } from './primitives.mjs';

const isPath = path => isPackagePath(path) && !path.startsWith('node_modules');

function copyOf(id, entry, deps) {
  const spec = entry.miroir;
  if (spec === undefined) return null;
  const from = spec.depuis === undefined ? entry.fichier : spec.depuis;
  if (!isPath(from || '') || !isPath(spec.vers || '')) throw new Error(`${id} : miroir.depuis et miroir.vers sont des chemins relatifs (le premier dans le paquet)${entry.fichier ? '' : ', et depuis est à dire pour une adresse qui n\'est pas celle d\'un paquet npm'}`);
  if (deps[entry.paquet] === undefined) throw new Error(`${id} : ${entry.paquet} n'est pas dans la liste`);
  return { paquet: entry.paquet, depuis: from, vers: spec.vers };
}

// Les fichiers à poser : ceux des bibliothèques de la liste qui disent leur `miroir`, puis les fichiers que seuls les essais lisent.
function copiesOf(packageJson, deps, spec) {
  const copies = Object.entries(packageJson.gfs.bibliotheques || {}).map(([id, entry]) => copyOf(id, entry, deps)).filter(Boolean);
  for (const extra of spec.supplementaires || []) {
    if (deps[extra.paquet] === undefined) throw new Error(`gfs.miroir.supplementaires : ${extra.paquet} n'est pas dans la liste`);
    copies.push(copyOf(extra.paquet, { paquet: extra.paquet, miroir: extra }, deps));
  }
  return copies;
}

// Les noms nus de la carte dont le miroir construit un module : ceux de `gfs.carte.paquets`, moins `sansEsm`.
export function modulesOf(packageJson, spec, where = 'gfs.miroir') {
  const names = (packageJson.gfs.carte && packageJson.gfs.carte.paquets) || [];
  const without = spec.sansEsm || [];
  for (const name of without) if (!names.includes(name)) throw new Error(`${where}.sansEsm : ${name} n'est pas dans la carte`);
  return names.filter(name => !without.includes(name));
}

// Ce que le miroir fait, sans rien faire : { dossier, prefixe, dependencies, esm, copies }, ou null quand la liste ne déclare pas de miroir. `esm` : les noms nus à construire ; `copies` : les fichiers à poser.
export function mirrorPlan(packageJson) {
  const spec = packageJson.gfs && packageJson.gfs.miroir;
  if (spec === undefined) return null;
  const deps = { ...packageJson.devDependencies, ...packageJson.dependencies };
  if (!isPath(spec.dossier || '')) throw new Error('gfs.miroir.dossier : un dossier relatif à l\'app attendu');
  if (!/^\/[^\s]*\/$/.test(spec.prefixe || '')) throw new Error('gfs.miroir.prefixe : une adresse qui commence et finit par « / » attendue');
  const dependencies = Object.fromEntries(Object.entries(deps).sort(([a], [b]) => (a < b ? -1 : 1)));
  return { dossier: spec.dossier, prefixe: spec.prefixe, dependencies, esm: modulesOf(packageJson, spec), copies: copiesOf(packageJson, deps, spec) };
}

// Le nom d'un module construit : `@tiptap/core` devient `tiptap__core`.
export const moduleName = name => name.replace('@', '').replace('/', '__');

export function installDeps(dir) {
  execFileSync('npm', ['install', '--no-audit', '--no-fund', '--silent'], { cwd: dir, stdio: 'inherit' });
}

export const loadEsbuildFrom = dir => createRequire(join(dir, 'x.js'))('esbuild');

// Les modules ES de la carte, construits d'un seul tenant (`splitting`) dans `outdir` ; rend ce que `esbuild.build` rend (avec `metafile`, les fichiers lus, d'où l'on tire les licences d'une copie).
export async function bundleModules(dir, names, esbuild, outdir, { metafile = false, minify = false } = {}) {
  const entries = {};
  mkdirSync(join(dir, 'entries'), { recursive: true });
  for (const name of names) {
    const file = join('entries', `${moduleName(name)}.js`);
    writeFileSync(join(dir, file), `export * from ${JSON.stringify(name)};\n`);
    entries[moduleName(name)] = join(dir, file);
  }
  return esbuild.build({ entryPoints: entries, outdir, bundle: true, splitting: true, format: 'esm', platform: 'browser', target: 'es2022', legalComments: 'none', logLevel: 'warning', absWorkingDir: dir, metafile, minify });
}

async function bundleEsm(dir, plan, esbuild) {
  await bundleModules(dir, plan.esm, esbuild, join(dir, 'esm'));
  writeFileSync(join(dir, 'esm-map.json'), `${JSON.stringify(Object.fromEntries(plan.esm.map(name => [name, `${plan.prefixe}${moduleName(name)}.js`])), null, 2)}\n`);
}

// Refait le miroir de `root` : sa liste de paquets (`package.json` du miroir), `npm install`, les modules ES de la carte, les fichiers copiés. `install(dossier)` et `loadEsbuild(dossier)` sont injectés pour les essais.
export async function buildMirror(root, packageJson, { install = installDeps, loadEsbuild = loadEsbuildFrom } = {}, log = text => process.stdout.write(text)) {
  const plan = mirrorPlan(packageJson);
  if (plan === null) throw new Error('la liste ne déclare pas de miroir (gfs.miroir)');
  const dir = join(root, plan.dossier);
  for (const old of ['esm', 'umd', 'entries']) rmSync(join(dir, old), { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), `${JSON.stringify({ name: 'miroir-des-bibliotheques', private: true, description: 'Refait par kit/outils/bibliotheques.mjs --miroir d\'après la liste de l\'app, jamais à la main, jamais commité.', dependencies: plan.dependencies }, null, 2)}\n`);
  install(dir);
  if (plan.esm.length) await bundleEsm(dir, plan, loadEsbuild(dir));
  for (const copy of plan.copies) {
    const from = join(dir, 'node_modules', copy.paquet, copy.depuis);
    if (!existsSync(from)) throw new Error(`${copy.paquet} : ${copy.depuis} n'est pas dans le paquet installé`);
    mkdirSync(dirname(join(dir, copy.vers)), { recursive: true });
    copyFileSync(from, join(dir, copy.vers));
  }
  log(`miroir : ${plan.esm.length} module(s) ES, ${plan.copies.length} fichier(s) copié(s) dans ${plan.dossier}\n`);
  return plan;
}
