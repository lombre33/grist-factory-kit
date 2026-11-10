// Ce que partagent l'outil des bibliothèques d'une app (outils/bibliotheques.mjs) et celui de GFS (la liste des bibliothèques d'extension, cahier 4.7) : l'empreinte d'un fichier, une version exacte,
// le fichier d'un paquet npm, et la comparaison du catalogue avec ce que le CDN sert vraiment. Rien ici ne connaît ni une app ni GFS ; un outil de développement, jamais chargé par une page.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const EXACT_VERSION_RE = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

// L'empreinte d'un fichier, comme l'attribut `integrity` d'une balise script : sha384 en base 64.
export const integrity = bytes => `sha384-${createHash('sha384').update(bytes).digest('base64')}`;

// Un chemin dans un paquet : relatif, sans « .. ».
export const isPackagePath = path => typeof path === 'string' && path !== '' && !path.startsWith('/') && !path.split('/').some(segment => segment === '..' || segment === '');

// Le nom que `npm pack` donne à l'archive d'un paquet : `@portee/nom` devient `portee-nom`.
export const archiveName = (paquet, version) => `${paquet.replace(/^@/, '').replace('/', '-')}-${version}.tgz`;

// L'archive d'un paquet : celle du dossier hors ligne si elle y est, sinon `npm pack` (qui vérifie l'intégrité donnée par le registre).
export function archiveOf(paquet, version, packagesDir, workDir) {
  const archive = packagesDir ? join(packagesDir, archiveName(paquet, version)) : null;
  if (archive && existsSync(archive)) return archive;
  const out = execFileSync('npm', ['pack', `${paquet}@${version}`, '--silent', '--pack-destination', workDir], { encoding: 'utf8' }).trim().split('\n').pop();
  return join(workDir, out);
}

// Les octets d'un fichier d'un paquet, tirés de son archive (le dossier `package/` que `npm pack` y met).
export function packFile(paquet, version, fichier, packagesDir, workDir) {
  const archive = archiveOf(paquet, version, packagesDir, workDir);
  execFileSync('tar', ['-xzf', archive, '-C', workDir, `package/${fichier}`]);
  return readFileSync(join(workDir, 'package', fichier));
}

// Ce que le navigateur exige d'un script à empreinte servi par un CDN, en plus des octets : l'en-tête CORS (sans lui, l'empreinte n'est pas contrôlée et le script est refusé,
// surtout dans un cadre isolé dont l'origine est opaque) et un type JavaScript (un module est refusé sinon).
function headerProblems(entry, headers) {
  const found = [];
  if (headers.cors !== '*' && headers.cors !== 'null') found.push(`${entry.id} : le CDN ne donne pas l'en-tête CORS (access-control-allow-origin : ${headers.cors || 'absent'})`);
  if (!/(java|ecma)script/i.test(headers.type || '')) found.push(headers.type ? `${entry.id} : le CDN sert le fichier comme « ${headers.type} », pas comme du JavaScript` : `${entry.id} : le CDN ne dit pas le type du fichier (content-type absent), il faut du JavaScript`);
  return found;
}

// Compare au CDN réel. `fetchFile(url)` rend { bytes, headers: { cors, type } } (ou seulement les octets, sans contrôle des en-têtes) ; injecté : le réseau n'est pas toujours là.
// Une entrée sans CDN n'a rien à comparer.
export async function checkCdn(catalogue, fetchFile) {
  const problems = [];
  for (const entry of (catalogue.bibliotheques || []).filter(candidate => candidate.cdn)) {
    try {
      const answer = await fetchFile(entry.cdn.src);
      const { bytes, headers } = Buffer.isBuffer(answer) ? { bytes: answer, headers: null } : answer;
      const got = integrity(bytes);
      if (got !== entry.cdn.integrite) problems.push(`${entry.id} : le CDN sert un fichier d'empreinte ${got}, le catalogue dit ${entry.cdn.integrite}`);
      if (headers) problems.push(...headerProblems(entry, headers));
    } catch (error) { problems.push(`${entry.id} : le CDN n'a pas répondu (${error.message})`); }
  }
  return problems;
}

// Ce que le CDN rend d'une adresse : les octets et les deux en-têtes que le navigateur exige d'un script à empreinte (checkCdn).
export async function fetchFile(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return { bytes: Buffer.from(await response.arrayBuffer()), headers: { cors: response.headers.get('access-control-allow-origin'), type: response.headers.get('content-type') } };
}
