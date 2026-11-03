// Les textes du sélecteur de couleur (la palette et la fenêtre « Couleur personnalisée »), français et anglais côte à côte. Repris de Publipostage+ (js/i18n.js, clés `color.*` et
// `colorDropdown.*`) avec le préfixe du kit ; js/i18n.js les ajoute à ceux du kit, si bien que `I18n.t('kit.color.apply')` marche sans rien déclarer. Les noms des rangées de couleurs gardées
// (« Couleurs du modèle »…) et celui du bouton qui retire la couleur sont ceux de l'app : le sélecteur les reçoit.

export const COLOR_STRINGS = Object.freeze({
  'kit.color.palette': { fr: 'Palette de couleurs', en: 'Color palette' },
  'kit.color.custom': { fr: 'Couleur personnalisée', en: 'Custom color' },
  'kit.color.customLabel': { fr: 'Personnalisé…', en: 'Custom…' },
  'kit.color.empty': { fr: 'Aucune', en: 'None' },
  'kit.color.forget': { fr: 'Retirer {color} de la liste', en: 'Remove {color} from the list' },
  'kit.color.area': { fr: 'Saturation et luminosité', en: 'Saturation and brightness' },
  'kit.color.areaValue': { fr: 'Saturation {s} %, luminosité {v} %', en: 'Saturation {s}%, brightness {v}%' },
  'kit.color.hue': { fr: 'Teinte', en: 'Hue' },
  'kit.color.hex': { fr: 'Code hexadécimal', en: 'Hex code' },
  'kit.color.hexHint': { fr: '3 ou 6 caractères (0–9, A–F), ex. #1E8449', en: '3 or 6 characters (0–9, A–F), e.g. #1E8449' },
  'kit.color.red': { fr: 'Rouge', en: 'Red' },
  'kit.color.green': { fr: 'Vert', en: 'Green' },
  'kit.color.blue': { fr: 'Bleu', en: 'Blue' },
  'kit.color.r': { fr: 'R', en: 'R' },
  'kit.color.g': { fr: 'V', en: 'G' },
  'kit.color.b': { fr: 'B', en: 'B' },
  'kit.color.current': { fr: 'Actuelle', en: 'Current' },
  'kit.color.new': { fr: 'Nouvelle', en: 'New' },
  'kit.color.keep': { fr: 'Garder cette couleur dans', en: 'Keep this color in' },
  'kit.color.apply': { fr: 'Appliquer', en: 'Apply' },
});
