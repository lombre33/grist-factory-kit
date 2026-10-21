// La page d'essai du kit : un bouton par fenêtre, pour que les essais les ouvrent à la vraie souris. Rien ici n'est du kit ; c'est ce qu'une app en fait.
import { I18n } from '../js/i18n.js';
import { Theme } from '../js/theme.js';
import { Layers } from '../js/layers.js';
import { ModalBase } from '../js/modal-base.js';
import { Dialogs } from '../js/dialogs.js';
import { h } from '../js/dom.js';

I18n.add({
  'page.title': { fr: 'Page d\'essai du kit', en: 'Kit test page' },
  'page.intro': { fr: 'Chaque bouton ouvre une fenêtre du kit.', en: 'Each button opens a kit window.' },
  'page.introTip': { fr: 'Aide de la page', en: 'Page help' },
  'page.placeholder': { fr: 'Un champ de la page', en: 'A page field' },
  'page.fieldLabel': { fr: 'Champ de la page', en: 'Page field' },
  'page.prompt': { fr: 'Saisie', en: 'Prompt' },
  'page.confirm': { fr: 'Confirmation', en: 'Confirmation' },
  'page.danger': { fr: 'Suppression', en: 'Deletion' },
  'page.choose': { fr: 'Choix', en: 'Choice' },
  'page.notice': { fr: 'Information', en: 'Notice' },
  'page.long': { fr: 'Long message', en: 'Long message' },
  'page.window': { fr: 'Fenêtre', en: 'Window' },
  'page.theme': { fr: 'Thème', en: 'Theme' },
  'page.lang': { fr: 'Langue', en: 'Language' },
  'page.name': { fr: 'Nom du modèle', en: 'Template name' },
  'page.delete': { fr: 'Supprimer « {name} » ?', en: 'Delete "{name}"?' },
  'page.deleteVerb': { fr: 'Supprimer', en: 'Delete' },
  'page.count': { fr: '{n} {n|ligne|lignes} à supprimer.', en: '{n} {n|row|rows} to delete.' },
  'page.save': { fr: 'Enregistrer', en: 'Save' },
  'page.discard': { fr: 'Abandonner', en: 'Discard' },
  'page.remove': { fr: 'Retirer', en: 'Remove' },
});

const $ = id => document.getElementById(id);
const kit = { I18n, Theme, Layers, ModalBase, Dialogs, results: [], windows: {} };
window.kit = kit;

// Ce que la page garde de chaque réponse, pour que les essais la relisent : le nom de la demande et sa valeur ('(indéfini)' pour undefined, que JSON ne porte pas).
const record = (name, promise) => promise.then(value => { kit.results.push({ name, value: value === undefined ? '(indéfini)' : value }); });

Theme.init({ storageKey: 'kit_theme' });
I18n.init({ storageKey: 'kit_lang' });
const translate = () => I18n.translateDom();
translate();
I18n.onChange(translate);

$('open-prompt').addEventListener('click', () => record('prompt', Dialogs.prompt({ title: I18n.t('page.name'), label: I18n.t('page.name'), value: 'Facture', placeholder: 'Facture' })));
$('open-confirm').addEventListener('click', () => record('confirm', Dialogs.confirm({ title: I18n.t('page.confirm'), message: I18n.t('page.count', { n: 3 }) })));
$('open-danger').addEventListener('click', () => record('danger', Dialogs.confirm({ title: I18n.t('page.danger'), message: I18n.t('page.delete', { name: 'Facture' }), confirmLabel: I18n.t('page.deleteVerb'), danger: true })));
$('open-choose').addEventListener('click', () => record('choose', Dialogs.choose({
  title: I18n.t('page.choose'), message: I18n.t('page.count', { n: 1 }),
  choices: [{ value: 'discard', label: I18n.t('page.discard') }, { value: 'save', label: I18n.t('page.save'), primary: true }],
})));
$('open-notice').addEventListener('click', () => record('notice', Dialogs.notice({ title: I18n.t('page.notice'), message: I18n.t('page.count', { n: 2 }) })));
$('open-long').addEventListener('click', () => record('long', Dialogs.notice({
  title: I18n.t('page.long'),
  message: Array.from({ length: 40 }, (_, i) => `${i + 1}. ${I18n.t('page.count', { n: i + 1 })}`).join('\n'),
})));

// Une fenêtre à soi sur la base du kit : un formulaire, un bouton de tête « Retirer », puis Annuler et Enregistrer.
let own = null;
$('open-window').addEventListener('click', () => {
  if (!own) {
    own = ModalBase.create({ id: 'own-modal', titleId: 'own-title', size: 'lg' });
    own.body.append(h('label', { for: 'own-name' }, I18n.t('page.name')), h('input', { id: 'own-name', type: 'text', value: 'Facture' }), h('input', { id: 'own-flag', type: 'checkbox' }));
    own.buttons = own.addButtons('pp-modal-danger');
    own.buttons.first.textContent = I18n.t('page.remove');
    own.buttons.cancel.textContent = I18n.t('kit.cancel');
    own.buttons.cancel.addEventListener('click', () => own.hide());
    own.buttons.ok.textContent = I18n.t('page.save');
    own.buttons.ok.addEventListener('click', () => own.hide());
    kit.windows.own = own;
  }
  own.title.textContent = I18n.t('page.window');
  own.show();
});

$('theme-toggle').addEventListener('click', () => Theme.set(Theme.isDark() ? 'light' : 'dark'));
$('lang-toggle').addEventListener('click', () => { const next = I18n.language === 'fr' ? 'en' : 'fr'; I18n.setLanguage(next); I18n.store(next); });
$('raise-a').addEventListener('click', () => Layers.raise($('menu-a')));
$('raise-b').addEventListener('click', () => Layers.raise($('menu-b')));
$('raise-tip').addEventListener('click', () => Layers.raise($('tip')));

// Le même module chargé par une autre adresse, comme le ferait un `?v=` posé sur l'un des imports et pas sur l'autre : le kit doit le dire.
if (location.hash === '#double') import('../js/i18n.js?v=2');
