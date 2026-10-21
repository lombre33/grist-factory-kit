// Les essais du kit dans un vrai navigateur (Chromium, Playwright) : la page navigateur/page.html sous la politique de sécurité d'une app hébergée, au format du panneau de Grist
// (700 × 400), à la vraie souris et au vrai clavier. `node navigateur/essais.mjs` ; les captures vont dans navigateur/captures/ (ou KIT_CAPTURES).
// Playwright : celui du dossier du dépôt si on l'y a installé, sinon celui du conteneur du cloud. Les essais sous Node (test/) ne demandent rien.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, serve, ROOT, say, check, tally } from './aide.mjs';
import { themeSources, themeKept, storageRefused, language, loadedTwice } from './scenarios-theme.mjs';
import { dialogs, ownWindow, layers } from './scenarios-fenetres.mjs';
import { gfsLink } from './scenarios-gfs.mjs';

const shots = process.env.KIT_CAPTURES || join(ROOT, 'navigateur', 'captures');
await mkdir(shots, { recursive: true });
const { origin, close } = await serve();
const browser = await chromium.launch();
const env = { browser, origin, shots, problems: [], external: [] };

// Un essai qui plante est un échec, pas la fin des autres.
async function run(name, scenario) {
  say(`\n== ${name}`);
  try { await scenario(); } catch (error) { check(`${name} : l'essai s'est arrêté`, false, String(error && error.stack || error)); }
}

await run('thème : les trois sources', () => themeSources(env));
await run('thème : le choix gardé', () => themeKept(env));
await run('stockage refusé', () => storageRefused(env));
await run('langue', () => language(env));
await run('double chargement', () => loadedTwice(env));
await run('lien avec GFS, dans un cadre isolé', () => gfsLink(env));
for (const system of ['light', 'dark']) {
  for (const locale of ['fr-FR', 'en-US']) await run(`saisies et confirmations (${system}, ${locale})`, () => dialogs(env, system, locale));
  await run(`fenêtre libre (${system})`, () => ownWindow(env, system));
  await run(`couches (${system})`, () => layers(env, system));
}

say('\n== politique de sécurité du contenu et réseau');
check('aucune erreur de page ni de console (la politique de la page refuse les styles et scripts en ligne et tout hôte extérieur)', env.problems.length === 0, env.problems.slice(0, 5));
check('aucune requête hors du serveur local : le kit ne charge ni police, ni script, ni image d\'un autre site', env.external.length === 0, env.external.slice(0, 5));

await browser.close();
close();
say(`\n${tally.ok} vérifications réussies, ${tally.failed} en échec. Captures : ${shots}`);
