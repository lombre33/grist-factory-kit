// Les fichiers du kit lus tels quels pour les essais d'hygiène (test/hygiene.test.mjs, test/calendrier-hygiene.test.mjs) : ceux d'un dossier, sous-dossiers compris, avec leur texte ; et
// `code()`, le code sans ses commentaires ni ses chaînes (ce que les règles visent : une chaîne qui cite `innerHTML` pour l'interdire n'est pas un emploi).
import { readFileSync, readdirSync, statSync } from 'node:fs';

const racine = new URL('../', import.meta.url);

function chemins(dossier, relatif = '') {
  return readdirSync(new URL(`${dossier}/${relatif}`, racine)).flatMap(nom => {
    const chemin = `${relatif}${nom}`;
    return statSync(new URL(`${dossier}/${chemin}`, racine)).isDirectory() ? chemins(dossier, `${chemin}/`) : [chemin];
  });
}

// Les fichiers de `dossier` (js, css) dont le chemin répond à `motif` : { file: 'js/calendrier/index.js', text }.
export const fichiersDe = (dossier, motif) => chemins(dossier)
  .filter(chemin => motif.test(chemin))
  .map(chemin => ({ file: `${dossier}/${chemin}`, text: readFileSync(new URL(`${dossier}/${chemin}`, racine), 'utf8') }));

export function code(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
    .replace(/'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}
