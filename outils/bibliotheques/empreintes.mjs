// Les empreintes que le code d'une app écrit à côté de l'adresse d'un script qu'il charge à la demande (`{ src: 'https://…', integrity: 'sha384-…' }`, que son chargeur de scripts passe à une balise) :
// la liste n'en dit qu'une, celle du catalogue, et l'outil la reporte dans le code (cahier 4.7 : « empreintes régénérées depuis la liste »). Une adresse que le code écrit sans qu'elle soit dans la liste est une
// bibliothèque cachée : l'outil la dit, il ne la devine pas.
//   "gfs": { "code": { "dossiers": ["js", "extensions"] } }      les dossiers de l'app à lire (relatifs à sa racine, récursifs)
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { isPackagePath } from './primitives.mjs';

// `src: 'adresse', integrity: 'sha384-…'` (guillemets simples ou doubles, ordre src puis integrity, sur une ou plusieurs lignes) : les parties avant, l'adresse, le milieu, l'empreinte, l'après.
const LITERAL = /(\bsrc\s*:\s*(['"]))(https:\/\/[^'"\s]+)(\2\s*,\s*integrity\s*:\s*\2)(sha384-[A-Za-z0-9+/=]+)(\2)/g;

export function readCodeSpec(packageJson) {
  const spec = packageJson.gfs && packageJson.gfs.code;
  if (spec === undefined) return null;
  if (!Array.isArray(spec.dossiers) || spec.dossiers.length === 0 || !spec.dossiers.every(isPackagePath)) throw new Error('gfs.code.dossiers : une liste de dossiers relatifs à l\'app attendue');
  return { dossiers: spec.dossiers };
}

function filesUnder(root, dir) {
  const out = [];
  const scan = path => {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const full = join(path, entry.name);
      if (entry.isDirectory()) scan(full);
      else if (/\.m?js$/.test(entry.name)) out.push(full);
    }
  };
  try { scan(join(root, dir)); } catch (error) { if (error.code !== 'ENOENT') throw error; throw new Error(`gfs.code.dossiers : ${dir} n'existe pas dans l'app`); }
  return out;
}

const integrityOf = catalogue => new Map((catalogue.bibliotheques || []).filter(entry => entry.cdn).map(entry => [entry.cdn.src, entry.cdn.integrite]));

// Le code avec chaque empreinte accordée au catalogue ; `unknown` : les adresses écrites avec une empreinte qui ne sont pas dans la liste.
export function rewriteLiterals(text, catalogue) {
  const known = integrityOf(catalogue);
  const unknown = [];
  const next = text.replace(LITERAL, (whole, head, quote, address, middle, sri, tail) => {
    if (!known.has(address)) { unknown.push(address); return whole; }
    return `${head}${address}${middle}${known.get(address)}${tail}`;
  });
  return { text: next, unknown };
}

// Les écarts d'un fichier : une empreinte qui n'est pas celle du catalogue, une adresse qui n'est pas dans la liste.
export function checkLiterals(text, catalogue) {
  const known = integrityOf(catalogue);
  return [...text.matchAll(LITERAL)].flatMap(match => {
    if (!known.has(match[3])) return [`${match[3]} : écrite avec une empreinte, mais pas dans la liste (l'y ajouter : gfs.bibliotheques)`];
    return known.get(match[3]) === match[5] ? [] : [`${match[3]} : l'empreinte écrite (${match[5]}) n'est pas celle du catalogue (${known.get(match[3])})`];
  });
}

// Accorde le code de `root` au catalogue : rend les fichiers réécrits et les adresses inconnues de la liste.
export function writeLiterals(root, spec, catalogue) {
  const changed = [];
  const unknown = [];
  for (const dir of spec.dossiers) {
    for (const file of filesUnder(root, dir)) {
      const text = readFileSync(file, 'utf8');
      const result = rewriteLiterals(text, catalogue);
      unknown.push(...result.unknown.map(address => `${relative(root, file)} : ${address}`));
      if (result.text !== text) { writeFileSync(file, result.text); changed.push(relative(root, file)); }
    }
  }
  return { changed, unknown };
}

// Les écarts du code de `root` avec le catalogue, fichier par fichier.
export function readLiterals(root, spec, catalogue) {
  return spec.dossiers.flatMap(dir => filesUnder(root, dir).flatMap(file => checkLiterals(readFileSync(file, 'utf8'), catalogue).map(problem => `${relative(root, file)} : ${problem}`)));
}
