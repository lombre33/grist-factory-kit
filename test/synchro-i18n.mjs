// Écrit par outils/reprendre-synchro.mjs : ne pas modifier ici.
import { TEXTES } from '../js/synchro/textes.js';

const frenchSpaces = text => text.replace(/ ([:;?!»])/g, '\u00a0$1').replace(/« /g, '«\u00a0');

export function format(lang, key, vars = {}) {
  const text = TEXTES[lang][key] ?? TEXTES.fr[key] ?? key;
  const value = name => (typeof vars[name] === 'number' ? vars[name].toLocaleString(lang) : vars[name]);
  return (lang === 'fr' ? frenchSpaces(text) : text)
    .replace(/\{(\w+)\|([^|}]*)\|([^}]*)\}/g, (all, name, one, many) => {
      const n = Number(vars[name]);
      return (lang === 'fr' ? n <= 1 : n === 1) ? one : many;
    })
    .replace(/\{(\w+)\}/g, (all, name) => (value(name) ?? `{${name}}`));
}
