// L'outil des bibliothèques d'une app (cahier 4.7, étape 4). Une seule liste : le `package.json` à la racine de l'app (versions exactes, et une section `gfs`), d'où il tire, sans rien écrire à la main :
//   - le catalogue (bibliotheques/catalogue.json) : l'adresse de CDN et l'empreinte de chaque fichier que l'app charge ;
//   - la carte d'importation de la page (`<script type="importmap">` d'index.html), quand la liste en déclare une (carte.mjs) ;
//   - les empreintes que le code de l'app écrit à côté des adresses qu'il charge (`src: '…', integrity: '…'`), reportées depuis le catalogue (empreintes.mjs) ;
//   - la politique de sécurité de la page : le `script-src` de la balise `<meta http-equiv="Content-Security-Policy">` d'index.html (les adresses du catalogue et l'empreinte de chaque script en ligne,
//     la carte d'importation comprise) ; les autres directives restent telles que l'app les a écrites.
// La liste d'une app :
//   "dependencies" : { "jszip": "3.10.1", "marked": "15.0.12" }
//   "gfs": { "bibliotheques": { "jszip": { "paquet": "jszip", "fichier": "dist/jszip.min.js" },                                            un fichier de paquet npm, servi par jsDelivr
//                               "marked": { "paquet": "marked", "src": "https://cdnjs.cloudflare.com/ajax/libs/marked/15.0.12/marked.min.js" } },  un fichier d'un autre CDN
//            "page": "index.html",
//            "politique": { "scriptSrc": ["'self'", "'unsafe-eval'", "https://docs.getgrist.com/grist-plugin-api.js"] } }                   ce que l'app écrit à la main, avant les adresses de la liste
// Un fichier de paquet npm : jsDelivr le sert octet pour octet, l'empreinte se prend sur l'archive npm (hors ligne possible). Un fichier d'un autre CDN (cdnjs) n'est pas celui du paquet : son empreinte
// se prend sur le CDN, une fois, puis le catalogue la garde tant que l'adresse ne change pas ; `--verifier-cdn` la compare ensuite à ce que le CDN sert.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { EXACT_VERSION_RE, integrity, isPackagePath, packFile, checkCdn, fetchFile } from './primitives.mjs';
import { readMap, importMapText, rewriteImportMap, checkImportMap, blank } from './carte.mjs';
import { readCopy, rewriteMapBlock, checkMapBlock, checkCopyFolder } from './copies.mjs';
import { readCodeSpec, writeLiterals, readLiterals } from './empreintes.mjs';

export const JSDELIVR = 'https://cdn.jsdelivr.net/npm';
const CATALOGUE = 'bibliotheques/catalogue.json';
const WIDTH = 150;
const SRI_RE = /^sha384-[A-Za-z0-9+/]{64}$/;
const readJson = (root, path) => JSON.parse(readFileSync(join(root, path), 'utf8'));

// L'adresse du CDN d'un fichier : jsDelivr pour un fichier de paquet, celle de la liste sinon.
export const addressOf = item => (item.src !== null ? item.src : `${JSDELIVR}/${item.paquet}@${item.version}/${item.fichier}`);

function checkSrc(id, src, version) {
  let url;
  try { url = new URL(src); } catch (error) { throw new Error(`${id} : « src » n'est pas une adresse (${src})`); }
  if (url.protocol !== 'https:' || url.search || url.hash) throw new Error(`${id} : « src » doit être une adresse https sans paramètre (${src})`);
  const names = version.replace(/[.+]/g, '\\$&');
  if (!new RegExp(`(?:^|/|@)${names}(?:/|$)`).test(url.pathname)) throw new Error(`${id} : l'adresse ${src} ne nomme pas la version exacte ${version} de la liste`);
}

// La liste d'une app : [{ id, paquet, version, fichier, src }], une entrée par fichier chargé. Versions exactes seulement, et une adresse qui nomme la version de la liste.
export function readAppList(packageJson) {
  const deps = packageJson.dependencies || {};
  const declared = (packageJson.gfs && packageJson.gfs.bibliotheques) || {};
  return Object.entries(declared).map(([id, spec]) => {
    const version = deps[spec.paquet];
    if (!EXACT_VERSION_RE.test(version || '')) throw new Error(`${id} : la version de ${spec.paquet} doit être exacte (reçu : ${version})`);
    const fichier = spec.fichier === undefined ? null : spec.fichier;
    const src = spec.src === undefined ? null : spec.src;
    if ((fichier === null) === (src === null)) throw new Error(`${id} : « fichier » (un fichier du paquet, servi par jsDelivr) ou « src » (l'adresse d'un autre CDN), l'un des deux`);
    if (fichier !== null && !isPackagePath(fichier)) throw new Error(`${id} : fichier hors du paquet`);
    if (src !== null) checkSrc(id, src, version);
    return { id, paquet: spec.paquet, version, fichier, src };
  });
}

// Ce que l'app écrit à la main dans `script-src`, et la page qui le porte.
export function readPolicy(packageJson) {
  const gfs = packageJson.gfs || {};
  const fixed = (gfs.politique && gfs.politique.scriptSrc) || null;
  if (fixed !== null && !(Array.isArray(fixed) && fixed.every(token => typeof token === 'string' && token !== ''))) throw new Error('gfs.politique.scriptSrc : une liste de sources attendue');
  return { page: gfs.page || 'index.html', fixed };
}

export const buildEntry = (item, bytes) => ({ id: item.id, version: item.version, cdn: { src: addressOf(item), integrite: integrity(bytes) } });
const catalogueText = entries => `${JSON.stringify({ outil: 'node kit/outils/bibliotheques.mjs', bibliotheques: entries }, null, 2)}\n`;

function kept(before, item) {
  const old = before.find(entry => entry.id === item.id && entry.version === item.version);
  return old && old.cdn && old.cdn.src === addressOf(item) && SRI_RE.test(old.cdn.integrite) ? { id: old.id, version: old.version, cdn: { src: old.cdn.src, integrite: old.cdn.integrite } } : null;
}

// Les octets d'un fichier d'un autre CDN, pris une seule fois : tant que le catalogue garde l'adresse, son empreinte reste celle qu'on a vue.
async function entryOf(item, { before, packagesDir, fetcher, work }) {
  if (item.fichier !== null) return buildEntry(item, packFile(item.paquet, item.version, item.fichier, packagesDir, work));
  const old = kept(before, item);
  if (old) return old;
  try {
    const answer = await fetcher(item.src);
    return buildEntry(item, Buffer.isBuffer(answer) ? answer : answer.bytes);
  } catch (error) { throw new Error(`${item.id} : ${item.src} n'a pas répondu (${error.message}) : l'empreinte d'un fichier qui n'est pas celui d'un paquet npm se prend sur son CDN, avec le réseau`); }
}

// Écrit le catalogue de l'app d'après sa liste.
export async function generateCatalogue(root, { packagesDir = null, fetcher = fetchFile } = {}) {
  const list = readAppList(readJson(root, 'package.json'));
  const before = existsSync(join(root, CATALOGUE)) ? readJson(root, CATALOGUE).bibliotheques || [] : [];
  const work = mkdtempSync(join(tmpdir(), 'kit-bibliotheques-'));
  try {
    const entries = [];
    for (const item of list) entries.push(await entryOf(item, { before, packagesDir, fetcher, work }));
    mkdirSync(dirname(join(root, CATALOGUE)), { recursive: true });
    writeFileSync(join(root, CATALOGUE), catalogueText(entries));
    return entries;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

// Les écarts entre la liste et le catalogue : une entrée absente, en trop, d'une autre version ou d'une autre adresse, une empreinte qui n'en est pas une.
export function checkCatalogue(catalogue, list) {
  const entries = catalogue.bibliotheques || [];
  const problems = [];
  for (const item of list) {
    const entry = entries.find(candidate => candidate.id === item.id);
    if (!entry) problems.push(`${item.id}@${item.version} : absent du catalogue`);
    else if (entry.version !== item.version) problems.push(`${item.id} : le catalogue dit ${entry.version}, la liste ${item.version}`);
    else if (!entry.cdn || entry.cdn.src !== addressOf(item)) problems.push(`${item.id} : l'adresse du catalogue n'est pas celle de la liste (${addressOf(item)})`);
    else if (!SRI_RE.test(entry.cdn.integrite || '')) problems.push(`${item.id} : l'empreinte du catalogue n'est pas un sha384`);
  }
  for (const entry of entries) if (!list.some(item => item.id === entry.id)) problems.push(`${entry.id}@${entry.version} : dans le catalogue mais plus dans la liste`);
  return problems;
}

// ---- La politique de sécurité de la page ----

export const inlineHash = body => `'sha256-${createHash('sha256').update(body, 'utf8').digest('base64')}'`;
// Les commentaires d'une page parlent de <script> et d'adresses : blanchis à longueur égale, ils ne comptent pas et les positions restent celles du texte brut.
const EXECUTED = /^(?:|module|importmap|(?:text|application)\/(?:java|ecma)script)$/i;
// Les deux cartes en données que le script de choix de la copie pose (copies.mjs) : rien ne les exécute, mais le script les injecte comme carte, et la politique cite l'empreinte de leur texte exact.
const MAP_DATA = /\bid\s*=\s*["']gfs-carte-(?:cdn|copie)["']/i;

// Les scripts en ligne d'une page (ceux sans `src` qui s'exécutent), la carte d'importation comprise : [{ hash, quoi }], dans l'ordre. Le hash est celui du texte entre les balises, espaces compris.
export function inlineScripts(html) {
  const found = [];
  for (const match of blank(html).matchAll(/<script\b([^>]*)>[\s\S]*?<\/script>/gi)) {
    if (/\bsrc\s*=/i.test(match[1])) continue;
    const type = (/\btype\s*=\s*["']?([^"'\s>]*)/i.exec(match[1]) || [])[1] || '';
    const data = /^application\/json$/i.test(type) && MAP_DATA.test(match[1]);
    if (!EXECUTED.test(type) && !data) continue;
    const body = html.slice(match.index + match[0].indexOf('>') + 1, match.index + match[0].length - '</script>'.length);
    found.push({ hash: inlineHash(body), quoi: type.toLowerCase() === 'importmap' || data ? 'la carte d\'importation' : `un script en ligne « ${body.trim().replace(/\s+/g, ' ').slice(0, 40)}… »` });
  }
  return found;
}

// La balise de la politique : où est son attribut `content`, et ce qu'il dit.
function policyOf(html) {
  const match = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"/i.exec(blank(html));
  if (!match) return null;
  const start = match.index + match[0].length - match[1].length - 1;
  return { start, end: start + match[1].length, content: match[1] };
}

// Où est la directive `script-src` dans le texte de la politique : de son nom à sa dernière source (sans les blancs avant le « ; »).
function directiveSpan(content) {
  const match = /(^|;)(\s*)script-src\b[^;]*/.exec(content);
  if (!match) return null;
  const start = match.index + match[1].length + match[2].length;
  return { start, end: start + content.slice(start, match.index + match[0].length).trimEnd().length };
}

const sourcesOf = text => text.trim().split(/\s+/).slice(1);

function wrap(tokens, first) {
  const lines = [];
  let line = first;
  for (const token of tokens) {
    const next = line.trim() === '' ? `${line}${token}` : `${line} ${token}`;
    if (line.trim() !== '' && next.length > WIDTH) { lines.push(line); line = `    ${token}`; } else line = next;
  }
  lines.push(line);
  return lines;
}

// Le `script-src` tel que l'outil l'écrit : ce que l'app écrit à la main, puis les adresses du catalogue, puis les empreintes des scripts en ligne, chaque suite sur ses lignes.
export function renderScriptSrc(fixed, addresses, hashes) {
  const lines = wrap(fixed, 'script-src');
  for (const group of [addresses, hashes]) if (group.length) lines.push(...wrap(group, '    '));
  return lines.join('\n');
}

// Les sources que `script-src` doit porter : [ce que l'app écrit, adresses, empreintes], déduites de la liste, du catalogue et de la page.
export function expectedSources(policy, catalogue, html) {
  const addresses = (catalogue.bibliotheques || []).map(entry => entry.cdn.src);
  return { fixed: policy.fixed || [], addresses: addresses.filter(address => !(policy.fixed || []).includes(address)), hashes: [...new Set(inlineScripts(html).map(script => script.hash))] };
}

// Le `script-src` de la page réécrit ; une erreur quand la page n'a ni politique ni `script-src` à réécrire.
function rewriteScriptSrc(html, policy, catalogue) {
  const meta = policyOf(html);
  const span = meta && directiveSpan(meta.content);
  if (!span) throw new Error('la page n\'a pas de <meta http-equiv="Content-Security-Policy"> avec un script-src : l\'écrire une fois à la main (le reste, l\'outil le tient)');
  const { fixed, addresses, hashes } = expectedSources(policy, catalogue, html);
  const content = `${meta.content.slice(0, span.start)}${renderScriptSrc(fixed, addresses, hashes)}${meta.content.slice(span.end)}`;
  return `${html.slice(0, meta.start)}${content}${html.slice(meta.end)}`;
}

// La page telle que la liste la dit : la carte d'importation d'abord (son empreinte change avec elle), puis le `script-src` qui cite les empreintes. Sans `mapText` (la liste ne déclare pas de carte)
// ou sans `gfs.politique`, la partie correspondante reste telle que l'app l'a écrite.
export function rewritePage(html, policy, catalogue, mapText = null, copy = null) {
  const withMap = mapText === null ? html : (copy === null ? rewriteImportMap(html, mapText) : rewriteMapBlock(html, mapText, copy));
  return policy.fixed === null ? withMap : rewriteScriptSrc(withMap, policy, catalogue);
}

function scriptSrcProblems(html, policy, catalogue) {
  const meta = policyOf(html);
  const span = meta && directiveSpan(meta.content);
  if (!span) return ['la page n\'a pas de <meta http-equiv="Content-Security-Policy"> avec un script-src'];
  const { fixed, addresses, hashes } = expectedSources(policy, catalogue, html);
  const wanted = [...fixed, ...addresses, ...hashes];
  const present = sourcesOf(meta.content.slice(span.start, span.end));
  const what = new Map(inlineScripts(html).map(script => [script.hash, script.quoi]));
  const problems = [
    ...wanted.filter(source => !present.includes(source)).map(source => `à ajouter à script-src : ${source}${what.has(source) ? ` (${what.get(source)})` : ''}`),
    ...present.filter(source => !wanted.includes(source)).map(source => `à retirer de script-src : ${source}`),
  ];
  if (problems.length === 0 && rewriteScriptSrc(html, policy, catalogue) !== html) problems.push('script-src n\'est pas écrit comme l\'outil l\'écrit : relancer l\'outil');
  return problems;
}

// Les écarts entre la page et ce que la liste dit : la carte d'importation, puis les sources de `script-src` (jugées sur la page avec sa carte à jour : c'est celle-là qu'il faut citer).
export function checkPage(html, policy, catalogue, mapText = null, copy = null) {
  const problems = mapText === null ? [] : (copy === null ? checkImportMap(html, mapText) : checkMapBlock(html, mapText, copy));
  if (policy.fixed === null) return problems;
  const withMap = mapText === null ? html : (copy === null ? rewriteImportMap(html, mapText) : rewriteMapBlock(html, mapText, copy));
  return [...problems, ...scriptSrcProblems(withMap, policy, catalogue)];
}

function reportLiterals({ changed, unknown }, log) {
  log(`code : ${changed.length ? `${changed.length} fichier(s) réécrit(s) (${changed.join(', ')})` : 'empreintes inchangées'}\n`);
  if (unknown.length) throw new Error(`des adresses sont écrites avec une empreinte sans être dans la liste (gfs.bibliotheques) :\n  - ${unknown.join('\n  - ')}`);
}

// Écrit le catalogue, les empreintes du code, puis la page de `root` d'après sa liste.
export async function generate(root, options = {}, log = text => process.stdout.write(text)) {
  const packageJson = readJson(root, 'package.json');
  if (!packageJson.gfs) throw new Error('package.json : pas de section « gfs » (la liste de l\'app : bibliotheques, page, politique, carte, miroir ; outils/bibliotheques/app.mjs la décrit)');
  const map = readMap(packageJson);
  const entries = await generateCatalogue(root, options);
  log(`catalogue : ${entries.length} fichier(s)\n`);
  const code = readCodeSpec(packageJson);
  if (code) reportLiterals(writeLiterals(root, code, { bibliotheques: entries }), log);
  const policy = readPolicy(packageJson);
  if ((policy.fixed === null && map === null) || !existsSync(join(root, policy.page))) return;
  const html = readFileSync(join(root, policy.page), 'utf8');
  const next = rewritePage(html, policy, { bibliotheques: entries }, map && importMapText(map), readCopy(packageJson));
  if (next !== html) writeFileSync(join(root, policy.page), next);
  log(`${policy.page} : ${next === html ? 'inchangée' : 'réécrite'}\n`);
}

// Relit les fichiers commités de `root` : les écarts entre la liste, le catalogue et la page.
export function verify(root) {
  const packageJson = readJson(root, 'package.json');
  const catalogue = readJson(root, CATALOGUE);
  const problems = checkCatalogue(catalogue, readAppList(packageJson));
  const code = readCodeSpec(packageJson);
  if (code) problems.push(...readLiterals(root, code, catalogue));
  const policy = readPolicy(packageJson);
  const map = readMap(packageJson);
  const copy = readCopy(packageJson);
  if (policy.fixed !== null || map !== null) problems.push(...checkPage(readFileSync(join(root, policy.page), 'utf8'), policy, catalogue, map && importMapText(map), copy).map(problem => `${policy.page} : ${problem}`));
  if (copy) problems.push(...checkCopyFolder(root, copy));
  return { catalogue, problems };
}

export { checkCdn };
