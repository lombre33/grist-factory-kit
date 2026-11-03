// La page d'essai du sélecteur de couleur : ce qu'une app en fait. Un bouton ouvre le menu de couleur dans le panneau de l'app, avec deux rangées gardées (celles de l'app, pas du kit) ; « Personnalisé… » ouvre la
// fenêtre du kit ; ce que le sélecteur rend est gardé pour que les essais le relisent. Rien ici n'est du kit.
import { I18n } from '../js/i18n.js';
import { Theme } from '../js/theme.js';
import { createColorPalette } from '../js/color-palette.js';
import { ColorDialog } from '../js/color-dialog.js';

I18n.add({
  'couleur.title': { fr: 'Sélecteur de couleur', en: 'Color picker' },
  'couleur.intro': { fr: 'Le menu de couleur d\'une app, avec ses rangées gardées, et la fenêtre « Couleur personnalisée ».', en: 'An app\'s color menu, with its saved rows, and the "Custom color" window.' },
  'couleur.open': { fr: 'Couleur', en: 'Color' },
  'couleur.window': { fr: 'Fenêtre seule', en: 'Window only' },
  'couleur.current': { fr: 'Couleur choisie', en: 'Chosen color' },
  'couleur.none': { fr: 'Par défaut', en: 'Default' },
  'couleur.rowTheme': { fr: 'Couleurs du thème', en: 'Theme colors' },
  'couleur.rowThemeHint': { fr: 'Réglées par le thème de la présentation', en: 'Set by the presentation theme' },
  'couleur.roleBackground': { fr: 'Fond', en: 'Background' },
  'couleur.roleText': { fr: 'Texte', en: 'Text' },
  'couleur.roleAccent1': { fr: 'Accent 1', en: 'Accent 1' },
  'couleur.roleAccent2': { fr: 'Accent 2', en: 'Accent 2' },
  'couleur.rowModel': { fr: 'Couleurs du modèle', en: 'Template colors' },
  'couleur.rowModelHint': { fr: 'Avec ce modèle seulement', en: 'With this template only' },
  'couleur.rowDocument': { fr: 'Couleurs partagées', en: 'Shared colors' },
  'couleur.rowDocumentHint': { fr: 'Pour tous les modèles du document, partagées avec l\'équipe', en: 'For every template in the document, shared with the team' },
});

const $ = id => document.getElementById(id);
const kit = { I18n, Theme, results: [], color: '#3b82f6', palette: null };
window.kit = kit;
const say = (name, value) => kit.results.push({ name, value });

Theme.init({ storageKey: 'kit_theme' });
I18n.init({ storageKey: 'kit_lang' });
const translate = () => I18n.translateDom();
translate();
I18n.onChange(translate);

// Les rangées gardées de l'app : ce qu'elle a rangé, et comment elle les nomme. Celle du thème se lit seulement : ni croix ni Suppr, chaque couleur porte le nom de son réglage.
const saved = { model: ['#1e8449', '#b91c1c'], document: [] };
const THEME = [['#ffffff', 'couleur.roleBackground'], ['#1b2430', 'couleur.roleText'], ['#1d4ed8', 'couleur.roleAccent1'], ['#be185d', 'couleur.roleAccent2']];
const rows = () => [
  { id: 'theme', label: I18n.t('couleur.rowTheme'), hint: I18n.t('couleur.rowThemeHint'), colors: THEME.map(([color]) => color), names: THEME.map(([, key]) => I18n.t(key)), readonly: true },
  { id: 'model', label: I18n.t('couleur.rowModel'), hint: I18n.t('couleur.rowModelHint'), colors: saved.model },
  { id: 'document', label: I18n.t('couleur.rowDocument'), hint: I18n.t('couleur.rowDocumentHint'), colors: saved.document },
];

function choose(color) {
  kit.color = color;
  $('current').style.setProperty('--current', color || 'transparent');
  if (kit.palette) kit.palette.mark(color);
}
choose(kit.color);
// L'app apprend une couleur ailleurs (elle sélectionne un autre objet) : elle la donne au menu, qui la marque.
kit.choose = choose;

function openWindow() {
  ColorDialog.open({
    initial: kit.color,
    scopes: rows().filter(row => !row.readonly).map(row => ({ id: row.id, label: row.label, hint: row.hint, checked: row.id === 'model' })),
    onApply: ({ color, scopes }) => {
      say('apply', { color, scopes });
      for (const id of scopes) if (!saved[id].includes(color)) saved[id].push(color);
      choose(color);
      if (kit.palette) kit.palette.setSaved(rows());
    },
    onClose: () => say('close', null),
  });
}

$('open-palette').addEventListener('click', () => {
  const host = $('palette-host');
  host.hidden = !host.hidden;
  if (host.hidden) return;
  kit.palette = createColorPalette({
    current: kit.color,
    noneLabel: I18n.t('couleur.none'),
    saved: rows(),
    onPick: color => { say('pick', color); choose(color); },
    onNone: () => { say('none', null); choose(null); },
    onCustom: openWindow,
    onForget: (row, color) => {
      say('forget', `${row}:${color}`);
      saved[row] = saved[row].filter(item => item !== color);
      kit.palette.setSaved(rows());
    },
  });
  host.replaceChildren(kit.palette.element);
});
$('open-window').addEventListener('click', openWindow);
