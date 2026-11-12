// L'app d'essai du lien : ce qu'une app fait du lien avec GFS, et ce qu'elle en a vu, que les essais lisent.
import { GfsLink } from '../js/gfs-link.js';
import { Ambiance } from '../js/ambiance.js';
import { Correcteurs } from '../js/correcteurs.js';
import { Theme } from '../js/theme.js';

const seen = { langue: [], ouvrir: [], ambiance: [] };
GfsLink.onLanguage(language => seen.langue.push(language));
GfsLink.onAmbiance(message => seen.ambiance.push(message && message.id));
Ambiance.start();
Correcteurs.start();
GfsLink.onOpen((request) => { seen.ouvrir.push(request); return true; });

const ownStorage = (() => {
  try { return typeof window.localStorage.length; } catch (error) { return 'refusé'; }
})();

// Les zones de texte de l'app d'essai des correcteurs : un éditeur dans un conteneur (la marque est sur lui, jamais sur le conteneur), une zone de texte, un champ, un mot de passe ;
// `addZone(préfixe)` en fait naître d'autres dans une fenêtre qui s'ouvre, comme une app qui ouvre une boîte de saisie.
const add = (parent, tag, attributes = {}) => {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
  parent.append(node);
  return node;
};
add(add(document.body, 'div', { id: 'wrap' }), 'div', { id: 'editor', contenteditable: 'true' });
add(document.body, 'textarea', { id: 'area' });
add(document.body, 'input', { id: 'field', type: 'text' });
add(document.body, 'input', { id: 'secret', type: 'password' });
const addZone = (prefix) => {
  const dialog = add(document.body, 'div', { id: `${prefix}-dialog` });
  add(add(dialog, 'p'), 'span');
  add(dialog, 'textarea', { id: `${prefix}-area` });
  add(add(dialog, 'div'), 'div', { id: `${prefix}-editor`, contenteditable: 'true' });
};

window.cadre = { GfsLink, Theme, seen, origin: window.origin, ownStorage, addZone };
