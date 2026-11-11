// L'outil des bibliothèques d'une app : d'après la liste de l'app (package.json à la racine), il écrit le catalogue des adresses de CDN et des empreintes (bibliotheques/catalogue.json) et le `script-src` de la
// politique de sécurité de la page (index.html). Mode d'emploi et forme de la liste : outils/bibliotheques/app.mjs, et le README du kit. Se lance depuis la racine de l'app (le kit y est le sous-module `kit/`) :
//
//   node kit/outils/bibliotheques.mjs                       écrit le catalogue et la politique (une adresse qui n'est pas celle d'un paquet npm se prend sur son CDN : réseau)
//   node kit/outils/bibliotheques.mjs --paquets <dossier>   idem, les paquets npm lus dans des archives <paquet>-<version>.tgz déjà téléchargées (hors ligne)
//   node kit/outils/bibliotheques.mjs --verifier            relit les fichiers commités, sans réseau : liste, catalogue, politique ; code de sortie 1 au moindre écart
//   node kit/outils/bibliotheques.mjs --verifier-cdn        idem, puis compare le catalogue à ce que les CDN servent vraiment (réseau) : octets, en-tête CORS, type JavaScript
//   node kit/outils/bibliotheques.mjs --miroir             refait le miroir des essais (gfs.miroir de la liste) : les paquets npm aux versions de la liste, les modules ES de la carte, les fichiers que les essais lisent (réseau : npm)
//   node kit/outils/bibliotheques.mjs --copies             refait la copie figée de la fonction que la liste déclare (gfs.copie) : les modules ES de la carte construits dans le dossier de l'app, avec leurs licences (réseau : npm), puis la page comme sans option
//   --racine <dossier>                                      l'app à traiter (le dossier courant par défaut)
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { generate, verify, checkCdn } from './bibliotheques/app.mjs';
import { buildMirror } from './bibliotheques/miroir.mjs';
import { buildCopy } from './bibliotheques/copies.mjs';
import { fetchFile } from './bibliotheques/primitives.mjs';

const option = (argv, name) => { const at = argv.indexOf(name); return at >= 0 ? argv[at + 1] : null; };

async function main(argv) {
  const root = resolve(option(argv, '--racine') || process.cwd());
  if (argv.includes('--verifier') || argv.includes('--verifier-cdn')) {
    const { catalogue, problems } = verify(root);
    if (argv.includes('--verifier-cdn')) problems.push(...await checkCdn(catalogue, fetchFile));
    problems.forEach(problem => process.stderr.write(`écart : ${problem}\n`));
    process.stdout.write(problems.length ? `${problems.length} écart(s)\n` : 'liste, catalogue et politique cohérents\n');
    process.exitCode = problems.length ? 1 : 0;
    return;
  }
  if (argv.includes('--miroir')) { await buildMirror(root, JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))); return; }
  const packages = option(argv, '--paquets');
  if (argv.includes('--copies')) { await buildCopy(root, JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))); await generate(root, { packagesDir: packages ? resolve(packages) : null }); return; }
  await generate(root, { packagesDir: packages ? resolve(packages) : null });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await main(process.argv.slice(2)); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
