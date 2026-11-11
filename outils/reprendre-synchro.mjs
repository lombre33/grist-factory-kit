// Reprend le moteur de partage de Sync+ (« Synchro Grist ») dans le kit : `js/engine/` devient `js/synchro/`, ses essais Node deviennent `test/synchro-*.test.mjs`, et les textes que le moteur demande
// à son hôte (`port.text`) sont rassemblés dans `js/synchro/textes.js`. Une copie à un commit : ce que GFS y corrige, il le dit dans la page d'état de Sync+ (consignes/sync/), et Sync+ reprend la version du kit.
//   node outils/reprendre-synchro.mjs /chemin/vers/grist-widget-one-way-sync
import { cpSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2] ? resolve(process.argv[2]) : '';
if (!source || !existsSync(join(source, 'js/engine/index.js'))) {
  process.stderr.write('Usage : node outils/reprendre-synchro.mjs <dépôt de Sync+> (le dossier doit contenir js/engine/)\n');
  process.exit(2);
}
const commit = execFileSync('git', ['-C', source, 'rev-parse', '--short', 'HEAD']).toString().trim();
const version = /ENGINE_VERSION\s*=\s*'([^']+)'/.exec(readFileSync(join(source, 'js/engine/version.js'), 'utf8'))[1];

// Le moteur : tel quel.
rmSync(join(KIT, 'js/synchro'), { recursive: true, force: true });
cpSync(join(source, 'js/engine'), join(KIT, 'js/synchro'), { recursive: true });

// Son mode d'emploi garde son texte, sous une note qui dit d'où vient la copie.
const readme = join(KIT, 'js/synchro/README.md');
writeFileSync(readme, `> **Copie** du moteur de Sync+ (commit \`${commit}\`, moteur ${version}), reprise par \`outils/reprendre-synchro.mjs\` : ne pas la modifier ici sans le dire à Sync+ (consignes/sync/ dans GFS). Les textes de l'hôte sont dans \`textes.js\`.\n\n${readFileSync(readme, 'utf8')}`);

// Ses essais : seuls ceux qui n'importent que le moteur (i18n.test.mjs est celui de l'écran de Sync+).
for (const name of readdirSync(KIT + '/test')) if (name.startsWith('synchro-')) rmSync(join(KIT, 'test', name), { recursive: true, force: true });
const tests = join(source, 'tests/unit');
let copied = 0;
for (const name of readdirSync(tests).sort()) {
  // Un dossier de références (`golden/`, le texte exact des formules) suit ses essais, sous un nom du kit ; seuls les fichiers sont des essais.
  if (statSync(join(tests, name)).isDirectory()) { cpSync(join(tests, name), join(KIT, 'test', `synchro-${name}`), { recursive: true }); continue; }
  const text = readFileSync(join(tests, name), 'utf8');
  // Un essai qui lit un écran de Sync+ (import statique ou dynamique) reste chez Sync+. Seuls `format` de js/i18n.js (le texte d'une clé, avec ses pluriels) est remplacé par un petit outil d'essai du kit, sur les textes
  // que le moteur demande ; i18n.test.mjs, qui garde les textes des écrans de Sync+, reste chez elle.
  if (name === 'i18n.test.mjs' || /(?:from |import\()'\.\.\/\.\.\/js\/(?!engine\/|i18n\.js')/.test(text)) continue;
  let target = name === 'fixtures.mjs' ? 'synchro-fixtures.mjs' : name === 'engine-fake.mjs' ? 'synchro-fake.mjs' : name.startsWith('engine') ? name.replace(/^engine/, 'synchro-moteur') : `synchro-${name}`;
  const rewritten = text
    .replaceAll("'../../js/engine/", "'../js/synchro/")
    .replaceAll("'../../js/i18n.js'", "'./synchro-i18n.mjs'")
    .replaceAll("'./fixtures.mjs'", "'./synchro-fixtures.mjs'")
    .replaceAll("'./engine-fake.mjs'", "'./synchro-fake.mjs'")
    .replaceAll("join(ROOT, 'js/engine')", "join(ROOT, 'js/synchro')")
    .replaceAll("'./golden/", "'./synchro-golden/")
    .replaceAll("'../..')", "'..')")
    // Le test du port de Sync+ lit son fichier `js/sync-port.js`, qui n'est pas dans le kit : le port de l'hôte (GFS) a ses propres essais.
    .replace(/test\('le port de Sync\+ a la forme[\s\S]*?\n\}\);\n\n/, '');
  writeFileSync(join(KIT, 'test', target), rewritten);
  copied += 1;
}

// L'outil d'essai qui tient la place de `format` de js/i18n.js de Sync+ : le texte d'une clé du moteur (textes.js), pluriels « {n|singulier|pluriel} » (en français 0 et 1 au singulier), nombres à la façon de la
// langue, espaces insécables du français. Écrit à chaque reprise (le nom commence par synchro-, les anciens sont effacés plus haut).
writeFileSync(join(KIT, 'test/synchro-i18n.mjs'), `// Écrit par outils/reprendre-synchro.mjs : ne pas modifier ici.
import { TEXTES } from '../js/synchro/textes.js';

const frenchSpaces = text => text.replace(/ ([:;?!»])/g, '\\u00a0$1').replace(/« /g, '«\\u00a0');

export function format(lang, key, vars = {}) {
  const text = TEXTES[lang][key] ?? TEXTES.fr[key] ?? key;
  const value = name => (typeof vars[name] === 'number' ? vars[name].toLocaleString(lang) : vars[name]);
  return (lang === 'fr' ? frenchSpaces(text) : text)
    .replace(/\\{(\\w+)\\|([^|}]*)\\|([^}]*)\\}/g, (all, name, one, many) => {
      const n = Number(vars[name]);
      return (lang === 'fr' ? n <= 1 : n === 1) ? one : many;
    })
    .replace(/\\{(\\w+)\\}/g, (all, name) => (value(name) ?? \`{\${name}}\`));
}
`);

// Les textes que le moteur demande à son hôte : `error.*`, `diag.*` et quelques `recv.*` de i18n/fr.json et i18n/en.json de Sync+.
const pick = file => {
  const all = JSON.parse(readFileSync(join(source, 'i18n', file), 'utf8'));
  return Object.fromEntries(Object.entries(all).filter(([key]) => /^(error\.|recv\.(archive\.col|lock\.waiting|result(\.none)?)$|diag\.)/.test(key)));
};
const textes = `// Les textes que le moteur de partage (js/synchro/) demande à son hôte par \`port.text(clé, valeurs)\`, en français et en anglais : \`error.<code>\` pour les erreurs prévues, \`diag.*\` pour le diagnostic à copier, \`recv.*\` pour ce qu'il écrit
// dans le document. Repris de i18n/fr.json et i18n/en.json de Sync+ (commit ${commit}, moteur ${version}) par outils/reprendre-synchro.mjs ; l'hôte rend la clé elle-même quand il ne la connaît pas.
export const TEXTES = Object.freeze({
  fr: Object.freeze(${JSON.stringify(pick('fr.json'), null, 2).replace(/\n/g, '\n  ')}),
  en: Object.freeze(${JSON.stringify(pick('en.json'), null, 2).replace(/\n/g, '\n  ')}),
});
`;
writeFileSync(join(KIT, 'js/synchro/textes.js'), textes);
process.stdout.write(`Moteur ${version} (Sync+ ${commit}) repris : js/synchro/, ${copied} fichiers d'essai, js/synchro/textes.js\n`);
