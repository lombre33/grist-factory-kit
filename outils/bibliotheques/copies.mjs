// La copie figée d'une fonction d'une app, rangée dans le dépôt de l'app (cahier 2, décisions du 11/11 ; contrats 1.3 point 3) : les modules ES de la carte (l'éditeur TipTap, ProseMirror) construits d'un seul
// tenant dans un dossier commité, avec leurs licences. La page garde deux cartes d'importation, celle du CDN et celle de la copie, et un petit script qui pose l'une des deux au démarrage : la copie quand
// l'adresse de la page dit `copie=<fonction>` (c'est GFS qui l'y met, d'après le choix de la personne), le CDN sinon. Deux cartes dans une page ne marchent pas (Firefox ignore la seconde : faits 93), d'où
// une seule carte, posée par un script ; la politique de sécurité cite l'empreinte du script et celle du texte exact de chaque carte.
//   "gfs": { "copie": { "fonction": "editeur",                       l'identifiant que GFS met dans l'adresse (`copie=editeur`) et que l'app lit par `GfsLink.copies()`
//                       "dossier": "vendor/editeur",                 où loge la copie, commitée (l'adresse de ses modules est relative à la page)
//                       "sansEsm": ["@tiptap/pm"],                   des paquets de la carte que le code n'importe jamais par leur nom
//                       "cle": "pp_editeur_copie" } }                facultatif : une clé du stockage du navigateur qui vaut `copie` pour choisir la copie quand l'app tourne seule (jamais lue sans try/catch)
// Une copie par app : la carte est une. Rien n'est chargé depuis une adresse lue dans la page ou le stockage : le script choisit entre deux textes que la page porte.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isPackagePath, integrity } from './primitives.mjs';
import { readMap, mapProblems, importMapElement, blank } from './carte.mjs';
import { bundleModules, installDeps, loadEsbuildFrom, modulesOf, moduleName } from './miroir.mjs';

export const CDN_ID = 'gfs-carte-cdn';
export const COPY_ID = 'gfs-carte-copie';
const NAME_RE = /^[A-Za-z0-9_.-]+$/;
const LICENCE_RE = /^(?:licen[cs]e|copying)(?:[-.].*)?$/i;

// La déclaration de la copie, vérifiée ; `null` quand la liste n'en déclare pas.
export function readCopy(packageJson) {
  const spec = packageJson.gfs && packageJson.gfs.copie;
  if (spec === undefined) return null;
  const carte = readMap(packageJson);
  if (carte === null) throw new Error('gfs.copie : la copie est celle des modules de la carte, et la liste ne déclare pas de carte (gfs.carte)');
  if (!NAME_RE.test(spec.fonction || '')) throw new Error('gfs.copie.fonction : un identifiant attendu (lettres, chiffres, « - », « _ »)');
  if (!isPackagePath(spec.dossier) || spec.dossier.startsWith('node_modules')) throw new Error('gfs.copie.dossier : un dossier relatif à l\'app attendu');
  if (spec.cle !== undefined && !NAME_RE.test(spec.cle)) throw new Error('gfs.copie.cle : un nom de clé attendu (lettres, chiffres, « - », « _ »)');
  return { fonction: spec.fonction, dossier: spec.dossier, prefixe: `./${spec.dossier}/`, cle: spec.cle === undefined ? null : spec.cle, modules: modulesOf(packageJson, spec, 'gfs.copie'), carte, deps: carte.deps };
}

// La carte de la copie : les entrées fixes de l'app (le kit), puis chaque module construit.
export function copyMapText(copy) {
  const imports = { ...copy.carte.fixes };
  for (const name of copy.modules) imports[name] = `${copy.prefixe}${moduleName(name)}.js`;
  return `\n${JSON.stringify({ imports }, null, 2)}\n`;
}

// Le script qui pose la carte, texte exact (la politique en prend l'empreinte).
export function bootstrapText(copy) {
  return `
(function () {
  var fonction = ${JSON.stringify(copy.fonction)}, cle = ${JSON.stringify(copy.cle)}, copie = false;
  try { copie = (new URLSearchParams(location.search).get('copie') || '').split(',').indexOf(fonction) >= 0; } catch (e) { /* adresse illisible : le CDN */ }
  try { if (!copie && cle !== null) copie = localStorage.getItem(cle) === 'copie'; } catch (e) { /* stockage indisponible : le CDN */ }
  var carte = document.createElement('script');
  carte.type = 'importmap';
  carte.textContent = document.getElementById(copie ? '${COPY_ID}' : '${CDN_ID}').textContent;
  document.head.appendChild(carte);
})();
`;
}

const BLOCK_RE = new RegExp(`<script type="application/json" id="${CDN_ID}">([\\s\\S]*?)</script>\\n<script type="application/json" id="${COPY_ID}">([\\s\\S]*?)</script>\\n<script>([\\s\\S]*?)</script>`);

// Le bloc que la page porte à la place de sa carte : les deux cartes en données (rien à exécuter, la politique ne s'y applique pas) et le script qui en pose une.
export const mapBlock = (cdnText, copy) => `<script type="application/json" id="${CDN_ID}">${cdnText}</script>\n<script type="application/json" id="${COPY_ID}">${copyMapText(copy)}</script>\n<script>${bootstrapText(copy)}</script>`;

function blockSpan(html) {
  const match = BLOCK_RE.exec(blank(html));
  return match ? { start: match.index, end: match.index + match[0].length } : null;
}

// La page avec son bloc des deux cartes : à la place du bloc déjà là, sinon à la place de la carte d'importation écrite une fois à la main.
export function rewriteMapBlock(html, cdnText, copy) {
  const span = blockSpan(html) || importMapElement(html);
  if (!span) throw new Error('la page n\'a ni <script type="importmap"> ni le bloc des deux cartes : écrire une fois la balise à la main, vide (le reste, l\'outil le tient)');
  return `${html.slice(0, span.start)}${mapBlock(cdnText, copy)}${html.slice(span.end)}`;
}

// Les écarts entre le bloc de la page et ce que la liste dit : l'une des deux cartes, le script, une carte d'importation restée en dur à côté.
export function checkMapBlock(html, cdnText, copy) {
  const span = blockSpan(html);
  if (!span) return ['la page n\'a pas le bloc des deux cartes d\'importation (CDN et copie) : relancer l\'outil'];
  const [, cdn, copie, script] = BLOCK_RE.exec(blank(html));
  const problems = [...mapProblems(cdn, cdnText, 'la carte du CDN'), ...mapProblems(copie, copyMapText(copy), 'la carte de la copie')];
  if (script !== bootstrapText(copy)) problems.push('le script qui choisit la carte n\'est pas celui de l\'outil : relancer l\'outil');
  if (importMapElement(`${html.slice(0, span.start)}${' '.repeat(span.end - span.start)}${html.slice(span.end)}`)) problems.push('une carte d\'importation en dur reste à côté du bloc (deux cartes ne marchent pas) : la retirer');
  return problems;
}

// ---- Le dossier de la copie ----

const FILES = 'COPIE.json';
const LICENCES = 'LICENCES.txt';
const jsFiles = dir => readdirSync(dir).filter(name => name.endsWith('.js')).sort();

// Les paquets lus par la construction : { nom → { version, racine } }, d'après les fichiers que `metafile` dit avoir lus (le dernier `node_modules/` d'un chemin nomme le paquet).
export function packagesRead(work, metafile) {
  const found = {};
  for (const input of Object.keys(metafile.inputs)) {
    const match = /^(.*node_modules\/((?:@[^/]+\/)?[^/]+))\//.exec(input);
    if (!match || found[match[2]]) continue;
    const meta = JSON.parse(readFileSync(join(work, match[1], 'package.json'), 'utf8'));
    found[match[2]] = { version: meta.version, licence: meta.license || 'inconnue', racine: join(work, match[1]) };
  }
  return Object.fromEntries(Object.entries(found).sort(([a], [b]) => (a < b ? -1 : 1)));
}

// Le texte des licences : une rubrique par paquet, le fichier de licence du paquet tel quel.
export function licencesText(packages, copy) {
  const parts = [`Licences des bibliothèques de la copie « ${copy.fonction} » (refait par kit/outils/bibliotheques.mjs --copies d'après la liste de l'app, jamais à la main).\n`];
  for (const [name, item] of Object.entries(packages)) {
    const file = readdirSync(item.racine).find(candidate => LICENCE_RE.test(candidate));
    parts.push(`== ${name}@${item.version} : ${item.licence} ==\n${file ? readFileSync(join(item.racine, file), 'utf8').trim() : '(pas de fichier de licence dans le paquet)'}\n`);
  }
  return `${parts.join('\n')}`;
}

function copyManifest(copy, packages, outDir) {
  const files = Object.fromEntries(jsFiles(outDir).map(name => [name, integrity(readFileSync(join(outDir, name)))]));
  const versions = Object.fromEntries(Object.entries(packages).map(([name, item]) => [name, item.version]));
  return `${JSON.stringify({ outil: 'node kit/outils/bibliotheques.mjs --copies', fonction: copy.fonction, paquets: versions, fichiers: files }, null, 2)}\n`;
}

// Refait la copie de `root` : les paquets de la carte aux versions de la liste dans un dossier de travail, les modules ES construits d'un seul tenant (une seule instance de ProseMirror), les licences et le
// manifeste (versions lues, empreinte de chaque fichier) à côté. `install(dossier)` et `loadEsbuild(dossier)` sont injectés pour les essais.
export async function buildCopy(root, packageJson, { install = installDeps, loadEsbuild = loadEsbuildFrom } = {}, log = text => process.stdout.write(text)) {
  const copy = readCopy(packageJson);
  if (copy === null) throw new Error('la liste ne déclare pas de copie (gfs.copie)');
  const work = mkdtempSync(join(tmpdir(), 'kit-copie-'));
  try {
    const wanted = Object.fromEntries(copy.carte.paquets.map(name => [name, copy.deps[name]]));
    const dependencies = { ...wanted, esbuild: (packageJson.devDependencies || {}).esbuild };
    if (dependencies.esbuild === undefined) throw new Error('esbuild n\'est pas dans devDependencies de la liste (il construit la copie)');
    writeFileSync(join(work, 'package.json'), `${JSON.stringify({ name: 'copie-des-bibliotheques', private: true, dependencies }, null, 2)}\n`);
    install(work);
    const out = join(work, 'out');
    const result = await bundleModules(work, copy.modules, loadEsbuild(work), out, { metafile: true, minify: true });
    const packages = packagesRead(work, result.metafile);
    const target = join(root, copy.dossier);
    rmSync(target, { recursive: true, force: true });
    mkdirSync(target, { recursive: true });
    for (const name of jsFiles(out)) writeFileSync(join(target, name), readFileSync(join(out, name)));
    writeFileSync(join(target, LICENCES), licencesText(packages, copy));
    writeFileSync(join(target, FILES), copyManifest(copy, packages, out));
    log(`copie « ${copy.fonction} » : ${jsFiles(out).length} fichier(s), ${Object.keys(packages).length} paquet(s) dans ${copy.dossier}\n`);
    return copy;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

// Les versions que la copie dit avoir construites, face à celles de la liste, et les modules qu'elle devrait avoir.
function versionProblems(copy, manifest) {
  const problems = [];
  if (manifest.fonction !== copy.fonction) problems.push(`${copy.dossier}/${FILES} : la copie est celle de « ${manifest.fonction} », la liste dit « ${copy.fonction} »`);
  for (const name of copy.carte.paquets) {
    const built = manifest.paquets[name];
    if (built === undefined ? copy.modules.includes(name) : built !== copy.deps[name]) problems.push(`${name} : la copie a ${built === undefined ? 'rien' : built}, la liste dit ${copy.deps[name]} : refaire la copie (--copies)`);
  }
  for (const name of copy.modules) if (!(`${moduleName(name)}.js` in manifest.fichiers)) problems.push(`${moduleName(name)}.js : le module de ${name} manque à la copie : refaire la copie (--copies)`);
  return problems;
}

// Les fichiers du dossier, face à l'empreinte que le manifeste leur donne : un absent, un modifié, un en trop.
function fileProblems(dir, copy, manifest) {
  const problems = [];
  for (const [name, hash] of Object.entries(manifest.fichiers)) {
    if (!existsSync(join(dir, name))) problems.push(`${copy.dossier}/${name} absent`);
    else if (integrity(readFileSync(join(dir, name))) !== hash) problems.push(`${copy.dossier}/${name} n'est plus celui de la copie (empreinte) : refaire la copie (--copies)`);
  }
  for (const name of jsFiles(dir)) if (!(name in manifest.fichiers)) problems.push(`${copy.dossier}/${name} : un fichier que la copie ne connaît pas`);
  if (!existsSync(join(dir, LICENCES))) problems.push(`${copy.dossier}/${LICENCES} absent`);
  return problems;
}

// Les écarts entre le dossier commité de la copie et la liste : un fichier absent, modifié ou en trop, une version qui n'est plus celle de la liste.
export function checkCopyFolder(root, copy) {
  const dir = join(root, copy.dossier);
  if (!existsSync(join(dir, FILES))) return [`${copy.dossier}/${FILES} absent : la copie « ${copy.fonction} » n'est pas construite (node kit/outils/bibliotheques.mjs --copies)`];
  const manifest = JSON.parse(readFileSync(join(dir, FILES), 'utf8'));
  return [...versionProblems(copy, manifest), ...fileProblems(dir, copy, manifest)];
}
