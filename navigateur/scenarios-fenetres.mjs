// Les essais des fenêtres, des saisies et des confirmations, dans un vrai navigateur au format du panneau de Grist (700 × 400), à la vraie souris et au vrai clavier, en clair et en
// sombre, en français et en anglais : ce qui tient dans le panneau, ce qui défile, qui a le focus, ce que font Tab, Entrée et Échap, et les contrastes tels que le navigateur les rend.
import { join } from 'node:path';
import { check, click, press, rect, displayOf, focused, results, lastResult, dialogButtons, paint, numbers, openPage } from './aide.mjs';
import { light, dark, cssRgb, ratio } from '../test/jetons.mjs';

const WORDS = {
  fr: { cancel: 'Annuler', confirm: 'Valider', close: 'Fermer', discard: 'Abandonner', save: 'Enregistrer', delete: 'Supprimer', rows3: '3 lignes à supprimer.', rows1: '1 ligne à supprimer.' },
  en: { cancel: 'Cancel', confirm: 'Confirm', close: 'Close', discard: 'Discard', save: 'Save', delete: 'Delete', rows3: '3 rows to delete.', rows1: '1 row to delete.' },
};
const MODAL = '#pp-dialog-modal';
const BOX = `${MODAL} .pp-modal-box`;
const isHidden = async (page, selector) => (await displayOf(page, selector)) === 'none';
const open = async (page, button) => { await click(page, button); await page.waitForSelector(MODAL, { state: 'visible' }); };
// Un bouton de la saisie, trouvé par son libellé (nth-child compterait aussi les boutons cachés).
async function clickButton(page, text) {
  const box = await page.locator(`${MODAL} .pp-modal-actions button:not([hidden])`).filter({ hasText: text }).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
const inside = (box, panel = { width: 700, height: 400 }, gap = 12) => box.x >= gap - 0.5 && box.y >= gap - 0.5 && box.right <= panel.width - gap + 0.5 && box.bottom <= panel.height - gap + 0.5;
// Un texte et son fond, tels que le navigateur les rend : le rapport de contraste.
const contrastOf = (text, background) => ratio(numbers(text), numbers(background));

// La saisie : où elle se place, qui a le focus, ce que font la frappe, Entrée, Échap, Tab, Maj+Tab et un clic à côté.
async function promptScenario(env, page, tag, words) {
  await open(page, '#open-prompt');
  check(`[${tag}] la saisie tient dans le panneau de 700 × 400, avec 12 px de marge`, inside(await rect(page, BOX)), await rect(page, BOX));
  check(`[${tag}] le focus arrive sur le champ, texte sélectionné`, (await focused(page)) === 'pp-dialog-input'
    && await page.evaluate(() => { const input = document.getElementById('pp-dialog-input'); return input.value === 'Facture' && input.selectionStart === 0 && input.selectionEnd === 7; }));
  check(`[${tag}] les boutons par défaut sont « ${words.cancel} » et « ${words.confirm} » (langue de la page)`, JSON.stringify(await dialogButtons(page)) === JSON.stringify([words.cancel, words.confirm]), await dialogButtons(page));
  check(`[${tag}] la fenêtre est un dialogue modal nommé par son titre`, await page.$eval(BOX, el => el.getAttribute('role') === 'dialog' && el.getAttribute('aria-modal') === 'true' && document.getElementById(el.getAttribute('aria-labelledby')).textContent.length > 0));

  const order = [];
  for (const key of ['Tab', 'Tab', 'Tab']) { await press(page, key); order.push(await focused(page)); }
  check(`[${tag}] Tab tourne dans la fenêtre : champ, ${words.cancel}, ${words.confirm}, puis le champ`, JSON.stringify(order) === JSON.stringify([words.cancel, words.confirm, 'pp-dialog-input']), order);
  await press(page, 'Shift+Tab');
  check(`[${tag}] Maj+Tab depuis le champ va au dernier bouton`, (await focused(page)) === words.confirm);

  await page.mouse.click(5, 5);
  check(`[${tag}] un clic sur le voile ne ferme rien`, !(await isHidden(page, MODAL)));
  await press(page, 'Tab');
  check(`[${tag}] le focus tombé sur le voile revient dans la fenêtre au premier Tab`, (await focused(page)) === 'pp-dialog-input');

  await page.keyboard.type('Devis');
  await press(page, 'Enter');
  check(`[${tag}] Entrée valide la saisie : la valeur tapée remplace la sélection`, JSON.stringify(await lastResult(page)) === JSON.stringify({ name: 'prompt', value: 'Devis' }), await lastResult(page));
  check(`[${tag}] la fenêtre se ferme et le focus revient au bouton qui l'a ouverte`, (await isHidden(page, MODAL)) && (await focused(page)) === 'open-prompt');

  await open(page, '#open-prompt');
  await press(page, 'Escape');
  check(`[${tag}] Échap annule : la saisie rend null`, JSON.stringify(await lastResult(page)) === JSON.stringify({ name: 'prompt', value: null }) && (await focused(page)) === 'open-prompt');
  await open(page, '#open-prompt');
  await page.keyboard.press('Backspace');
  await press(page, 'Enter');
  check(`[${tag}] un champ laissé vide rend '' (et non null)`, JSON.stringify(await lastResult(page)) === JSON.stringify({ name: 'prompt', value: '' }), await lastResult(page));
  await open(page, '#open-prompt');
  await clickButton(page, words.confirm);
  check(`[${tag}] le bouton « ${words.confirm} » à la souris valide`, (await lastResult(page)).value === 'Facture');
}

// Confirmations, choix et information : le focus, les valeurs rendues, les boutons qui ne s'accumulent pas.
async function otherDialogs(page, tag, words) {
  await open(page, '#open-confirm');
  check(`[${tag}] la confirmation affiche son message (pluriel) et le focus arrive sur « ${words.confirm} »`, (await page.$eval('#pp-dialog-message', el => el.textContent)) === words.rows3 && (await focused(page)) === words.confirm);
  await press(page, 'Enter');
  check(`[${tag}] Entrée sur « ${words.confirm} » rend true`, (await lastResult(page)).value === true);

  await open(page, '#open-danger');
  check(`[${tag}] suppression : le focus arrive sur « ${words.cancel} », pas sur le bouton destructeur`, (await focused(page)) === words.cancel && (await dialogButtons(page)).join() === [words.cancel, words.delete].join());
  await press(page, 'Enter');
  check(`[${tag}] un Entrée distrait ne supprime rien : false`, (await lastResult(page)).value === false);

  await open(page, '#open-choose');
  const buttons = await dialogButtons(page);
  check(`[${tag}] choix : « ${words.cancel} » d'abord, puis les choix dans l'ordre, le focus sur celui qui est principal`, buttons.join() === [words.cancel, words.discard, words.save].join() && (await focused(page)) === words.save, buttons);
  await clickButton(page, words.discard);
  check(`[${tag}] un clic sur un choix rend sa valeur`, (await lastResult(page)).value === 'discard', await lastResult(page));
  await open(page, '#open-choose');
  await press(page, 'Escape');
  check(`[${tag}] Échap sur un choix rend null`, (await lastResult(page)).value === null);
  await open(page, '#open-confirm');
  check(`[${tag}] les boutons d'un choix ne restent pas pour la demande suivante`, (await dialogButtons(page)).join() === [words.cancel, words.confirm].join(), await dialogButtons(page));
  await press(page, 'Escape');
  check(`[${tag}] Échap sur une confirmation rend false`, (await lastResult(page)).value === false);

  await open(page, '#open-notice');
  check(`[${tag}] information : un seul bouton « ${words.close} », le focus dessus`, (await dialogButtons(page)).join() === words.close && (await focused(page)) === words.close, await dialogButtons(page));
  await press(page, 'Escape');
  check(`[${tag}] Échap ferme l'information (rend undefined) et rend le focus`, (await lastResult(page)).value === '(indéfini)' && (await focused(page)) === 'open-notice');
}

// Une demande qui arrive pendant qu'une autre est ouverte l'annule ; un long contenu défile sans emporter le titre ni les boutons.
async function stacking(page, tag) {
  await open(page, '#open-prompt');
  await page.evaluate(() => { window.kit.Dialogs.confirm({ title: 'Deuxième', message: 'Elle remplace la première.' }); });
  const all = await results(page);
  check(`[${tag}] une demande qui arrive annule celle qui est ouverte (rendue comme Annuler) et prend sa place`, all[all.length - 1].name === 'prompt' && all[all.length - 1].value === null
    && (await page.$eval('#pp-dialog-title', el => el.textContent)) === 'Deuxième', all.slice(-2));
  await press(page, 'Escape');

  await open(page, '#open-long');
  const geometry = async () => ({ header: await rect(page, `${BOX} .pp-modal-header`), actions: await rect(page, `${BOX} .pp-modal-actions`), box: await rect(page, BOX) });
  const before = await geometry();
  const scrolls = await page.$eval(`${BOX} .pp-modal-body`, el => el.scrollHeight > el.clientHeight);
  check(`[${tag}] un long message tient dans le panneau : la fenêtre ne dépasse pas, le contenu défile`, scrolls && inside(before.box), before.box);
  await page.mouse.move(350, 200);
  await page.mouse.wheel(0, 300);
  await page.waitForFunction(selector => document.querySelector(selector).scrollTop > 0, `${BOX} .pp-modal-body`, { timeout: 2000 }).catch(() => null);
  const after = await geometry();
  const scrolled = await page.$eval(`${BOX} .pp-modal-body`, el => el.scrollTop);
  check(`[${tag}] à la molette, seul le contenu défile : titre et boutons ne bougent pas et restent visibles`, scrolled > 0 && JSON.stringify(after) === JSON.stringify(before) && before.header.y >= 0 && before.actions.bottom <= 400, { scrolled, before, after });
  check(`[${tag}] la page derrière ne défile pas (overscroll-behavior)`, await page.evaluate(() => window.scrollY === 0));
  await press(page, 'Escape');
}

// Les couleurs telles que le navigateur les rend : le voile, le cadre, le texte et les boutons suivent le thème et tiennent 4,5:1.
async function colours(page, tag, theme) {
  const tokens = theme === 'dark' ? dark : light;
  await open(page, '#open-danger');
  const box = await paint(page, BOX);
  const scrim = (await paint(page, MODAL)).background;
  check(`[${tag}] le cadre est sur --surface et le voile sur --pp-scrim du thème`, box.background === cssRgb(tokens['--surface']) && JSON.stringify(numbers(scrim).map(n => Math.round(n * 100) / 100)) === JSON.stringify(numbers(tokens['--pp-scrim']).map(n => Math.round(n * 100) / 100)), { box, scrim, expected: tokens['--pp-scrim'] });
  const pairs = {
    'le titre': [await paint(page, `${BOX} h3`), box.background],
    'le message': [await paint(page, '#pp-dialog-message'), box.background],
    '« Annuler »': [await paint(page, `${MODAL} .pp-modal-actions button:first-of-type`), box.background],
    'le bouton principal (blanc sur --accent-solid)': [await paint(page, `${MODAL} .pp-modal-primary`), null],
  };
  for (const [what, [colours, background]] of Object.entries(pairs)) {
    const value = contrastOf(colours.color, background || colours.background);
    check(`[${tag}] contraste de ${what} : ${value.toFixed(2)}:1 (4,5:1 au moins)`, value >= 4.5);
  }
  await press(page, 'Escape');
}

// Les fenêtres en 4 variantes : clair et sombre, français et anglais.
export async function dialogs(env, system, locale) {
  const lang = locale.startsWith('fr') ? 'fr' : 'en';
  const tag = `${system === 'dark' ? 'sombre' : 'clair'} ${lang}`;
  const { page } = await openPage(env, { colorScheme: system, locale });
  await promptScenario(env, page, tag, WORDS[lang]);
  await otherDialogs(page, tag, WORDS[lang]);
  await stacking(page, tag);
  await colours(page, tag, system);
  await open(page, '#open-danger');
  await page.screenshot({ path: join(env.shots, `confirmation-${system === 'dark' ? 'sombre' : 'clair'}-${lang}.png`) });
  await press(page, 'Escape');
  await open(page, '#open-prompt');
  await page.screenshot({ path: join(env.shots, `saisie-${system === 'dark' ? 'sombre' : 'clair'}-${lang}.png`) });
  await page.context().close();
}

// Une fenêtre à soi sur ModalBase : sa largeur plafonnée, l'ordre de ses boutons, Tab, les fenêtres empilées, le focus rendu (ou non) et onEscape.
export async function ownWindow(env, system) {
  const tag = `fenêtre libre ${system === 'dark' ? 'sombre' : 'clair'}`;
  const { page } = await openPage(env, { colorScheme: system });
  await click(page, '#open-window');
  await page.waitForSelector('#own-modal', { state: 'visible' });
  const box = await rect(page, '#own-modal .pp-modal-box');
  check(`[${tag}] la grande fenêtre (960 px) est plafonnée à la largeur du panneau moins la marge : 676 px`, Math.abs(box.width - 676) <= 1 && inside(box), box);
  const order = await page.$$eval('#own-modal .pp-modal-actions > *', nodes => nodes.map(node => `${node.tagName.toLowerCase()}.${node.className}`));
  check(`[${tag}] les boutons : tête, espace, annuler, principal`, JSON.stringify(order) === JSON.stringify(['button.pp-modal-danger', 'span.pp-modal-spacer', 'button.', 'button.pp-modal-primary']), order);
  const [first, cancel] = [await rect(page, '#own-modal .pp-modal-danger'), await rect(page, '#own-modal .pp-modal-actions button:nth-of-type(2)')];
  check(`[${tag}] l'espace pousse « Annuler » et le principal à droite, le bouton de tête reste à gauche`, first.x < 60 && cancel.x > 350, { first, cancel });
  check(`[${tag}] le focus arrive sur le premier champ du contenu`, (await focused(page)) === 'own-name');
  const danger = await paint(page, '#own-modal .pp-modal-danger');
  const surface = (await paint(page, '#own-modal .pp-modal-box')).background;
  check(`[${tag}] le bouton de tête (--danger-ink) tient 4,5:1 sur le cadre : ${contrastOf(danger.color, surface).toFixed(2)}:1`, contrastOf(danger.color, surface) >= 4.5);

  const tabs = [];
  for (let i = 0; i < 5; i++) { await press(page, 'Tab'); tabs.push(await focused(page)); }
  check(`[${tag}] Tab parcourt le contenu puis les boutons, et boucle`, JSON.stringify(tabs) === JSON.stringify(['own-flag', 'Retirer', 'Annuler', 'Enregistrer', 'own-name']), tabs);

  await page.evaluate(() => { window.kit.Dialogs.confirm({ title: 'Par-dessus', message: 'Une confirmation s\'ouvre sur une fenêtre.' }); });
  const centre = await rect(page, BOX);
  const top = await page.evaluate(([x, y]) => (document.elementFromPoint(x, y).closest('.pp-modal') || {}).id, [centre.x + centre.width / 2, centre.y + 10]);
  check(`[${tag}] une saisie ou confirmation s'ouvre par-dessus une fenêtre`, top === 'pp-dialog-modal', top);
  await press(page, 'Escape');
  check(`[${tag}] Échap ne ferme que la fenêtre du dessus`, (await isHidden(page, MODAL)) && !(await isHidden(page, '#own-modal')));
  check(`[${tag}] le focus revient dans la fenêtre du dessous`, await page.evaluate(() => document.getElementById('own-modal').contains(document.activeElement)));
  await press(page, 'Escape');
  check(`[${tag}] le deuxième Échap ferme la fenêtre, le focus revient au bouton qui l'a ouverte`, (await isHidden(page, '#own-modal')) && (await focused(page)) === 'open-window');

  await click(page, '#open-window');
  await page.screenshot({ path: join(env.shots, `fenetre-libre-${system === 'dark' ? 'sombre' : 'clair'}.png`) });
  await press(page, 'Escape');

  const variants = await page.evaluate(async () => {
    const { ModalBase } = window.kit;
    const field = document.getElementById('field');
    field.focus();
    const quiet = ModalBase.create({ id: 'quiet', titleId: 'quiet-title', restoreFocus: false });
    quiet.show();
    quiet.hide();
    const stayedOnBody = document.activeElement !== field;
    field.focus();
    window.escapes = 0;
    const guarded = ModalBase.create({ id: 'guarded', titleId: 'guarded-title', size: 'sm', onEscape: () => { window.escapes += 1; } });
    guarded.show();
    return { stayedOnBody, isOpen: guarded.isOpen() };
  });
  check(`[${tag}] restoreFocus: false ne rend pas le focus`, variants.stayedOnBody);
  await press(page, 'Escape');
  const guarded = await page.evaluate(() => ({ open: document.getElementById('guarded').style.display !== 'none', escapes: window.escapes }));
  check(`[${tag}] onEscape remplace la fermeture : Échap l'appelle une fois et la fenêtre reste ouverte`, guarded.open && guarded.escapes === 1 && variants.isOpen, guarded);
  check(`[${tag}] la petite fenêtre (size: 'sm') fait 400 px`, Math.abs((await rect(page, '#guarded .pp-modal-box')).width - 400) <= 1);
  await page.context().close();
}

// Les couches : le dernier menu ouvert au-dessus, l'info-bulle au-dessus des menus, la barre flottante laissée à l'ordre du DOM, un popup qui passe devant la fenêtre qui l'ouvre.
export async function layers(env, system) {
  const tag = `couches ${system === 'dark' ? 'sombre' : 'clair'}`;
  const { page } = await openPage(env, { colorScheme: system });
  const topAt = (x, y) => page.evaluate(([px, py]) => { const el = document.elementFromPoint(px, py); return el && (el.closest('.pop') || el).id; }, [x, y]);
  const zOf = id => page.evaluate(name => document.getElementById(name).style.zIndex, id);
  check(`[${tag}] sans Layers.raise, l'info-bulle (--z-tip) est au-dessus des menus (--z-menu)`, (await topAt(420, 200)) === 'tip');
  await click(page, '#raise-a');
  await click(page, '#raise-b');
  check(`[${tag}] le dernier menu ouvert est au-dessus (B après A)`, (await topAt(500, 230)) === 'menu-b' && Number(await zOf('menu-b')) > Number(await zOf('menu-a')));
  await click(page, '#raise-a');
  check(`[${tag}] puis A, rouvert, repasse au-dessus de B`, (await topAt(500, 230)) === 'menu-a' && Number(await zOf('menu-a')) > Number(await zOf('menu-b')));
  const menuZ = Number(await zOf('menu-a'));
  check(`[${tag}] le rang reste dans le niveau des menus (1600 à 1699)`, menuZ >= 1600 && menuZ < 1700, menuZ);
  check(`[${tag}] l'info-bulle reste au-dessus d'un menu qu'on vient d'ouvrir`, (await topAt(420, 200)) === 'tip');
  await click(page, '#raise-tip');
  const tipZ = Number(await zOf('tip'));
  check(`[${tag}] une info-bulle ouverte prend un rang de son niveau (1800 à 1899)`, tipZ >= 1800 && tipZ < 1900, tipZ);
  const bar = await page.evaluate(() => { window.kit.Layers.raise(document.getElementById('bar')); return document.getElementById('bar').style.zIndex; });
  check(`[${tag}] une barre flottante garde l'ordre du DOM : raise n'y touche pas`, bar === '');
  const safe = await page.evaluate(() => { try { window.kit.Layers.raise(null); window.kit.Layers.raise(document.createElement('div')); window.kit.Layers.raise(undefined, null); return 'ok'; } catch (error) { return String(error); } });
  check(`[${tag}] raise ne dit rien d'un élément absent ou détaché`, safe === 'ok', safe);

  await open(page, '#open-prompt');
  const over = await page.evaluate(() => {
    const make = id => { const el = document.createElement('div'); el.id = id; el.className = 'pop pop-over'; el.textContent = id; document.body.append(el); return el; };
    const plain = make('plain');
    const lifted = make('lifted');
    window.kit.Layers.raise(plain);
    window.kit.Layers.raise(lifted, document.getElementById('pp-dialog-modal'));
    return { plain: plain.style.zIndex, lifted: lifted.style.zIndex };
  });
  check(`[${tag}] un popup ouvert depuis une saisie passe devant elle : niveau au-dessus de 2100`, Number(over.lifted) > 2100 && Number(over.lifted) < 2200 && Number(over.plain) < 1700, over);
  const atCentre = await topAt(360, 220);
  check(`[${tag}] à l'écran, c'est le popup qui reçoit la souris, pas le voile de la saisie`, atCentre === 'lifted', atCentre);
  await page.context().close();
}
