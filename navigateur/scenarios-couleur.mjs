// Les essais du sélecteur de couleur dans un vrai navigateur : le menu (la palette, les rangées gardées, le pied) et la fenêtre « Couleur personnalisée », au format du panneau de Grist (700 × 400), à
// la vraie souris et au vrai clavier, en clair et en sombre, en français et en anglais. La page est navigateur/couleur.html, sous la politique de sécurité d'une app hébergée : un style posé en ligne
// y est refusé, et l'erreur de page fait échouer l'essai (navigateur/essais.mjs).
import { join } from 'node:path';
import { check, click, press, rect, displayOf, focused, results, lastResult, paint, numbers, openPage } from './aide.mjs';
import { light, dark, cssRgb, ratio } from '../test/jetons.mjs';
import { ColorMath } from '../js/color-math.js';

const WORDS = {
  fr: {
    custom: 'Personnalisé…', none: 'Par défaut', apply: 'Appliquer', cancel: 'Annuler', title: 'Couleur personnalisée', current: 'Actuelle', fresh: 'Nouvelle', keep: 'Garder cette couleur dans',
    theme: 'Couleurs du thème', roles: ['Fond', 'Texte', 'Accent 1', 'Accent 2'], model: 'Couleurs du modèle', shared: 'Couleurs partagées', empty: 'Aucune', channels: ['Rouge', 'Vert', 'Bleu'], letters: ['R', 'V', 'B'],
    hint: '3 ou 6 caractères (0–9, A–F), ex. #1E8449', forget: 'Retirer #1E8449 de la liste', area: (s, v) => `Saturation ${s} %, luminosité ${v} %`,
  },
  en: {
    custom: 'Custom…', none: 'Default', apply: 'Apply', cancel: 'Cancel', title: 'Custom color', current: 'Current', fresh: 'New', keep: 'Keep this color in',
    theme: 'Theme colors', roles: ['Background', 'Text', 'Accent 1', 'Accent 2'], model: 'Template colors', shared: 'Shared colors', empty: 'None', channels: ['Red', 'Green', 'Blue'], letters: ['R', 'G', 'B'],
    hint: '3 or 6 characters (0–9, A–F), e.g. #1E8449', forget: 'Remove #1E8449 from the list', area: (s, v) => `Saturation ${s}%, brightness ${v}%`,
  },
};
const PANEL = '#palette-host';
const GRID = `${PANEL} .cp-grid .cp-swatch`;
const MODAL = '#kit-color-modal';
const BOX = `${MODAL} .pp-modal-box`;
const START = '#3b82f6'; // la couleur de la page d'essai au départ : la pastille « bleu vif »

const inside = (box, gap = 12) => box.x >= gap - 0.5 && box.y >= gap - 0.5 && box.right <= 700 - gap + 0.5 && box.bottom <= 400 - gap + 0.5;
const contrastOf = (text, background) => ratio(numbers(text), numbers(background));
const backgroundOf = (page, selector) => page.$eval(selector, el => getComputedStyle(el).backgroundColor);
const colorOf = page => page.evaluate(() => document.activeElement.dataset.color || null);
const texts = (page, selector) => page.$$eval(selector, nodes => nodes.map(node => node.textContent.trim()));
const hexRgb = hex => cssRgb(hex);
// Le fond que l'œil voit derrière un élément : le premier fond opaque en remontant les parents.
const backdrop = (page, selector) => page.$eval(selector, el => {
  for (let node = el; node; node = node.parentElement) {
    const color = getComputedStyle(node).backgroundColor;
    if (!color.startsWith('rgba(') || color.endsWith(', 1)')) return color;
  }
  return 'rgb(255, 255, 255)';
});
const fieldsOf = page => page.evaluate(() => ({
  hex: document.querySelector('#kit-color-modal .cp-hex').value,
  rgb: [...document.querySelectorAll('#kit-color-modal .cp-number')].map(input => input.value),
}));
// L'étape de Tab où est le clavier, nommée par ce qu'elle est.
const stopOf = page => page.evaluate(() => {
  const el = document.activeElement;
  if (el.classList.contains('cp-area')) return 'carré';
  if (el.classList.contains('cp-hue')) return 'teinte';
  if (el.classList.contains('cp-hex')) return 'code';
  if (el.classList.contains('cp-number')) return `canal ${[...document.querySelectorAll('.cp-number')].indexOf(el) + 1}`;
  if (el.type === 'checkbox') return `case ${el.value}`;
  return el.textContent.trim();
});
const openPalette = async page => { await click(page, '#open-palette'); await page.waitForSelector(`${PANEL} .cp-grid`, { state: 'visible' }); };
const openDialog = async page => { await click(page, '#open-window'); await page.waitForSelector(BOX, { state: 'visible' }); };
const closed = async page => (await displayOf(page, MODAL)) === 'none';
const shot = (env, page, system, lang, name) => page.screenshot({ path: join(env.shots, `couleur-${name}-${system === 'dark' ? 'sombre' : 'clair'}-${lang}.png`) });
const tagOf = (system, lang) => `${system === 'dark' ? 'sombre' : 'clair'} ${lang}`;

// ----- Le menu

// La forme du menu : dix colonnes, cinq rangées, des pastilles de 20 px à 24 px de pas ; deux colonnes dans un panneau court et large, une seule dans un panneau haut ou étroit.
async function paletteShape(page, tag, words) {
  await openPalette(page);
  const boxes = await page.$$eval(GRID, nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }));
  const columns = [...new Set(boxes.map(box => box.x))];
  const lines = [...new Set(boxes.map(box => box.y))];
  const steps = list => list.slice(1).map((value, at) => value - list[at]);
  check(`[${tag}] la palette : 50 pastilles sur dix colonnes et cinq rangées`, boxes.length === 50 && columns.length === 10 && lines.length === 5, { count: boxes.length, columns: columns.length, lines: lines.length });
  check(`[${tag}] pastilles de 20 px, à 24 px d'un centre à l'autre (une cible tactile)`, boxes.every(box => box.width === 20 && box.height === 20) && steps(columns).every(step => step === 24) && steps(lines).every(step => step === 24), boxes[0]);
  const names = await page.$eval(`${GRID}:first-child`, el => [el.title, el.getAttribute('aria-label'), el.getAttribute('aria-pressed')]);
  check(`[${tag}] chaque pastille se nomme par son code (infobulle et nom accessible)`, names[0] === '#000000' && names[1] === '#000000' && names[2] === 'false', names);
  const menu = await rect(page, PANEL);
  check(`[${tag}] le menu, avec ses trois rangées, tient dans le panneau de 700 × 400 (marge de 12 px) : ${Math.round(menu.width)} × ${Math.round(menu.height)}`, inside(menu), menu);
  const place = async () => ({ grid: await rect(page, `${PANEL} .cp-grid`), rows: await rect(page, `${PANEL} .cp-rows`), foot: await rect(page, `${PANEL} .cp-footer`) });
  const wide = await place();
  check(`[${tag}] panneau court et large : les rangées gardées sont à droite de la palette, le pied sous elle (menu de ${Math.round(menu.height)} px)`, wide.rows.x >= wide.grid.right && wide.foot.y >= wide.grid.bottom && wide.foot.right <= wide.rows.x + 0.5 && menu.height < 200, { menu, ...wide });
  await page.setViewportSize({ width: 700, height: 700 });
  const tall = await place();
  check(`[${tag}] panneau haut : les rangées gardées passent sous la palette, le pied dessous`, tall.rows.y >= tall.grid.bottom && tall.foot.y >= tall.rows.bottom - 0.5 && tall.rows.x === tall.grid.x, tall);
  await page.setViewportSize({ width: 420, height: 400 });
  const narrow = await place();
  const small = await rect(page, PANEL);
  check(`[${tag}] panneau étroit (420 px) : une seule colonne, et le menu ne dépasse pas`, narrow.rows.y >= narrow.grid.bottom && small.right <= 420 - 12 + 0.5 && small.bottom <= 400 - 12 + 0.5, { narrow, small });
  await page.setViewportSize({ width: 700, height: 400 });
  const rows = await texts(page, `${PANEL} .cp-row-label`);
  check(`[${tag}] trois rangées, nommées par l'app : « ${words.theme} », « ${words.model} » et « ${words.shared} »`, rows.join('|') === `${words.theme}|${words.model}|${words.shared}`, rows);
  check(`[${tag}] la rangée sans couleur dit « ${words.empty} »`, (await texts(page, `${PANEL} .cp-row.is-empty .cp-row-empty`)).join() === words.empty);
  check(`[${tag}] le pied porte « ${words.custom} » et « ${words.none} » ; les icônes sont des SVG`, (await texts(page, `${PANEL} .cp-footer button`)).join('|') === `${words.custom}|${words.none}` && (await page.$$eval(`${PANEL} .cp-footer svg`, nodes => nodes.length)) === 2);
}

const activeSwatches = page => page.$$eval(`${PANEL} .cp-swatch.is-active`, nodes => nodes.map(node => node.dataset.color));

// Un clic de souris sur une pastille la rend et la marque : anneau, coche, aria-pressed, et la couleur arrive dans la page.
async function palettePick(page, tag, system) {
  const tokens = system === 'dark' ? dark : light;
  const active = () => activeSwatches(page);
  await openPalette(page);
  check(`[${tag}] au départ, seule la pastille de la couleur du moment (${START}) est marquée`, JSON.stringify(await active()) === JSON.stringify([START]), await active());
  await click(page, `${GRID}[data-color="#0f766e"]`);
  const picked = await lastResult(page);
  check(`[${tag}] un clic de souris sur une pastille rend sa couleur`, picked.name === 'pick' && picked.value === '#0f766e', picked);
  check(`[${tag}] la couleur arrive dans la page par le CSSOM (la politique n'admet aucun style en ligne)`, (await backgroundOf(page, '#current')) === hexRgb('#0f766e'));
  const mark = await page.$eval(`${GRID}[data-color="#0f766e"]`, el => ({ pressed: el.getAttribute('aria-pressed'), ring: getComputedStyle(el).outlineColor, tick: getComputedStyle(el, '::after').borderRightColor, content: getComputedStyle(el, '::after').content }));
  check(`[${tag}] la pastille choisie est seule marquée : anneau d'accent, coche dans l'encre qui se lit sur elle (blanc), aria-pressed`, JSON.stringify(await active()) === '["#0f766e"]'
    && mark.pressed === 'true' && mark.ring === hexRgb(tokens['--accent']) && mark.tick === 'rgb(255, 255, 255)' && mark.content !== 'none', mark);
}

// Les marques du menu : une couleur gardée hors palette, une couleur lue dans la page (écrite « rgb(…) »), « sans couleur ».
async function paletteMarks(page, tag, system) {
  const tokens = system === 'dark' ? dark : light;
  const active = () => activeSwatches(page);
  await openPalette(page);
  await click(page, `${PANEL} .cp-row[data-row="model"] .cp-swatch[data-color="#1e8449"]`);
  check(`[${tag}] une couleur gardée hors palette : sa pastille gardée est seule marquée (« Personnalisé… » n'a pas besoin de l'être)`, (await lastResult(page)).value === '#1e8449'
    && JSON.stringify(await active()) === '["#1e8449"]' && !(await page.$eval(`${PANEL} .cp-custom`, el => el.classList.contains('is-active'))), await active());
  await page.evaluate(() => window.kit.choose('rgb(18, 52, 86)'));
  const custom = await page.$eval(`${PANEL} .cp-custom`, el => ({ on: el.classList.contains('is-active'), ring: getComputedStyle(el).outlineColor }));
  check(`[${tag}] une couleur lue dans la page (« rgb(18, 52, 86) ») qui n'est dans aucune pastille : aucune n'est marquée, « Personnalisé… » prend l'anneau d'accent`, (await active()).length === 0
    && custom.on && custom.ring === hexRgb(tokens['--accent']), { active: await active(), custom });
  await page.evaluate(() => window.kit.choose('rgb(15, 118, 110)'));
  check(`[${tag}] la même couleur écrite « rgb(15, 118, 110) » marque la pastille #0f766e`, JSON.stringify(await active()) === '["#0f766e"]', await active());
  await click(page, `${PANEL} .cp-none`);
  const none = await page.$eval(`${PANEL} .cp-none`, el => ({ on: el.classList.contains('is-active'), pressed: el.getAttribute('aria-pressed') }));
  check(`[${tag}] « sans couleur » : rend « none », la pastille de la page est vide, son bouton est marqué, plus aucune pastille ni « Personnalisé… »`, (await lastResult(page)).name === 'none'
    && (await backgroundOf(page, '#current')) === 'rgba(0, 0, 0, 0)' && none.on && none.pressed === 'true' && (await active()).length === 0
    && !(await page.$eval(`${PANEL} .cp-custom`, el => el.classList.contains('is-active'))), { none, active: await active() });
}

// Au clavier : une étape de Tab par rangée, les flèches, Début et Fin, Entrée et Espace.
async function paletteKeys(page, tag, words, system) {
  const tokens = system === 'dark' ? dark : light;
  await openPalette(page);
  const stops = selector => page.$$eval(selector, nodes => nodes.filter(node => node.tabIndex === 0).length);
  const counts = [];
  for (const selector of [`.cp-grid`, `.cp-row[data-row="theme"]`, `.cp-row[data-row="model"]`, `.cp-row[data-row="document"]`]) counts.push(await stops(`${PANEL} ${selector} .cp-swatch`));
  check(`[${tag}] une seule étape de Tab par rangée : la palette, la rangée du thème, celle du modèle ; la rangée vide n'en a pas`, counts.join() === '1,1,1,0', counts);
  await press(page, 'Tab');
  await press(page, 'Tab');
  check(`[${tag}] Tab arrive sur la pastille marquée de la palette (${START})`, (await colorOf(page)) === START, await colorOf(page));
  const rowOfFocus = () => page.evaluate(() => { const row = document.activeElement.closest('.cp-row'); return row ? row.dataset.row : null; });
  const walked = [];
  for (let i = 0; i < 4; i++) { await press(page, 'Tab'); walked.push(i < 2 ? await rowOfFocus() : await focused(page)); }
  check(`[${tag}] Tab continue : la rangée du thème, celle du modèle, « ${words.custom} », « ${words.none} » (les croix sont hors de l'ordre de Tab)`, walked.join('|') === `theme|model|${words.custom}|${words.none}`, walked);
  for (let i = 0; i < 4; i++) await press(page, 'Shift+Tab');

  const all = await page.$$eval(GRID, nodes => nodes.map(node => node.dataset.color));
  const goes = async (key, to) => { await press(page, key); return (await colorOf(page)) === all[to]; };
  const from = all.indexOf(START);
  const moves = [
    ['ArrowRight', from + 1], ['ArrowLeft', from], ['ArrowDown', from + 10], ['ArrowUp', from], ['Home', 0], ['ArrowLeft', 0], ['ArrowUp', 0], ['ArrowDown', 10], ['End', 49], ['ArrowRight', 49], ['ArrowDown', 49],
  ];
  const wrong = [];
  for (const [key, to] of moves) if (!(await goes(key, to))) wrong.push({ key, expected: all[to], got: await colorOf(page) });
  await press(page, 'Home');
  const ring = await page.evaluate(() => { const style = getComputedStyle(document.activeElement); return [style.outlineStyle, style.outlineColor, document.activeElement.classList.contains('is-active')]; });
  check(`[${tag}] le focus se voit sur une pastille non marquée : un anneau d'accent`, ring[0] === 'solid' && ring[1] === hexRgb(tokens['--accent']) && ring[2] === false, ring);
  await press(page, 'End');
  check(`[${tag}] les flèches, Début et Fin vont d'une pastille à l'autre (une ligne = 10) et s'arrêtent aux bords, sans boucler`, wrong.length === 0, wrong);
  await press(page, 'Enter');
  check(`[${tag}] Entrée sur une pastille la choisit`, (await lastResult(page)).name === 'pick' && (await lastResult(page)).value === all[49], await lastResult(page));
  await press(page, 'ArrowLeft');
  await press(page, 'Space');
  check(`[${tag}] Espace aussi`, (await lastResult(page)).value === all[48], await lastResult(page));
  check(`[${tag}] après un choix au clavier, l'étape de Tab est la pastille choisie`, await page.$eval(`${GRID}[data-color="${all[48]}"]`, el => el.tabIndex === 0));
}

// La rangée du thème de l'app : des pastilles nommées par leur réglage, sans croix, que Suppr ne retire pas ; le clavier ne la quitte pas.
async function themeRow(page, tag, words) {
  const row = `${PANEL} .cp-row[data-row="theme"]`;
  await openPalette(page);
  const names = await page.$$eval(`${row} .cp-swatch`, nodes => nodes.map(node => `${node.title}|${node.getAttribute('aria-label')}`));
  const expected = [['#FFFFFF', 0], ['#1B2430', 1], ['#1D4ED8', 2], ['#BE185D', 3]].map(([code, at]) => `${words.roles[at]} · ${code}|${words.roles[at]} · ${code}`);
  check(`[${tag}] la rangée « ${words.theme} » : quatre pastilles, chacune nommée par son réglage devant son code (« ${words.roles[2]} · #1D4ED8 »)`, names.join('/') === expected.join('/'), names);
  check(`[${tag}] ni croix ni enveloppe de couleur gardée dans cette rangée : il n'y a rien à retirer`, (await page.$$eval(`${row} .cp-forget, ${row} .cp-saved`, nodes => nodes.length)) === 0);
  for (let i = 0; i < 3; i++) await press(page, 'Tab');
  check(`[${tag}] Tab arrive sur la rangée du thème, première pastille`, (await colorOf(page)) === '#ffffff' && (await page.evaluate(() => document.activeElement.closest('.cp-row').dataset.row)) === 'theme');
  const before = (await results(page)).length;
  await press(page, 'Delete');
  await press(page, 'Backspace');
  check(`[${tag}] Suppr et Retour arrière n'y retirent rien (aucune demande « forget », toujours quatre pastilles)`, (await results(page)).length === before && (await page.$$eval(`${row} .cp-swatch`, nodes => nodes.length)) === 4);
  const walked = [];
  for (const key of ['ArrowRight', 'ArrowDown', 'End', 'ArrowRight']) { await press(page, key); walked.push(await colorOf(page)); }
  check(`[${tag}] les flèches vont d'une pastille à l'autre dans la rangée, Fin à la dernière, sans passer à la rangée du dessous`, walked.join() === '#1b2430,#1b2430,#be185d,#be185d', walked);
  await press(page, 'Enter');
  check(`[${tag}] Entrée la choisit : « pick » #be185d, et la page prend cette couleur`, (await lastResult(page)).value === '#be185d' && (await backgroundOf(page, '#current')) === hexRgb('#be185d'), await lastResult(page));
  await page.evaluate(() => window.kit.choose('#1b2430'));
  check(`[${tag}] une couleur du thème absente de la palette : sa pastille du thème est seule marquée`, JSON.stringify(await activeSwatches(page)) === '["#1b2430"]', await activeSwatches(page));
}

// Les rangées gardées : la croix au survol, la souris et Suppr, le focus qui reste dans le menu.
async function savedRows(page, tag, words) {
  await openPalette(page);
  const swatch = `${PANEL} .cp-row[data-row="model"] .cp-saved .cp-swatch[data-color="#1e8449"]`;
  const cross = `${PANEL} .cp-row[data-row="model"] .cp-forget[data-color="#1e8449"]`;
  check(`[${tag}] la croix qui retire une couleur est cachée tant que la souris n'est pas dessus`, (await displayOf(page, cross)) === 'none');
  const box = await rect(page, swatch);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  check(`[${tag}] au survol de la pastille, la croix apparaît ; son nom dit « ${words.forget} »`, (await displayOf(page, cross)) !== 'none'
    && (await page.$eval(cross, el => [el.title, el.getAttribute('aria-label')])).join('|') === `${words.forget}|${words.forget}`, await page.$eval(cross, el => el.title));
  await click(page, cross);
  const forgotten = await lastResult(page);
  check(`[${tag}] un clic sur la croix retire la couleur de sa rangée (sans la choisir) : « ${forgotten.value} »`, forgotten.name === 'forget' && forgotten.value === 'model:#1e8449'
    && (await page.$$eval(`${PANEL} .cp-row[data-row="model"] .cp-swatch`, nodes => nodes.map(node => node.dataset.color))).join() === '#b91c1c' && (await backgroundOf(page, '#current')) === hexRgb(START));
  check(`[${tag}] le clavier reste dans le menu : sur la couleur gardée qui reste`, (await colorOf(page)) === '#b91c1c' && (await page.evaluate(() => document.activeElement.dataset.row)) === 'model', await colorOf(page));
  await press(page, 'Delete');
  check(`[${tag}] Suppr retire la couleur sur laquelle est le clavier ; la rangée dit « ${words.empty} » et le clavier passe à « ${words.custom} »`, (await lastResult(page)).value === 'model:#b91c1c'
    && (await texts(page, `${PANEL} .cp-row[data-row="model"] .cp-row-empty`)).join() === words.empty && (await focused(page)) === words.custom, { last: await lastResult(page), focus: await focused(page) });
}

// Les couleurs du menu telles que le navigateur les rend : 4,5:1 au moins pour tout texte.
async function paletteContrast(page, tag, system) {
  await openPalette(page);
  const wrong = [];
  for (const selector of ['.cp-row-label', '.cp-row-empty']) {
    const color = await page.$eval(`${PANEL} ${selector}`, el => getComputedStyle(el).color);
    const value = contrastOf(color, await backdrop(page, `${PANEL} ${selector}`));
    if (value < 4.5) wrong.push({ selector, value });
  }
  for (const selector of ['.cp-custom', '.cp-none']) {
    const { color, background } = await paint(page, `${PANEL} ${selector}`);
    const value = contrastOf(color, background);
    if (value < 4.5) wrong.push({ selector, value });
  }
  check(`[${tag}] contraste des textes du menu (noms des rangées, « Aucune », les deux boutons du pied) : 4,5:1 au moins`, wrong.length === 0, wrong);
  const surface = (system === 'dark' ? dark : light)['--surface'];
  check(`[${tag}] le fond du menu est celui que lui donne la page (--surface)`, (await backgroundOf(page, PANEL)) === hexRgb(surface));
}

export async function colorPalette(env, system, locale) {
  const lang = locale.startsWith('fr') ? 'fr' : 'en';
  const words = WORDS[lang];
  const tag = tagOf(system, lang);
  const fresh = async () => (await openPage(env, { colorScheme: system, locale, path: 'couleur.html' }));
  const steps = [page => paletteShape(page, tag, words), page => palettePick(page, tag, system), page => paletteMarks(page, tag, system), page => paletteKeys(page, tag, words, system),
    page => themeRow(page, tag, words), page => savedRows(page, tag, words), page => paletteContrast(page, tag, system)];
  for (const step of steps) {
    const { page, warnings } = await fresh();
    await step(page);
    if (step === steps[0]) await shot(env, page, system, lang, 'menu');
    check(`[${tag}] aucun avertissement de la console`, warnings.length === 0, warnings);
    await page.context().close();
  }
}

// ----- La fenêtre

// L'ouverture : la place, le focus, les textes, l'aperçu, les cases « garder ».
async function dialogStart(page, tag, words) {
  await openPalette(page);
  await click(page, `${PANEL} .cp-custom`);
  await page.waitForSelector(BOX, { state: 'visible' });
  const box = await rect(page, BOX);
  const body = await page.$eval(`${BOX} .pp-modal-body`, el => [el.scrollHeight, el.clientHeight]);
  check(`[${tag}] la fenêtre tient dans le panneau de 700 × 400 (marge de 12 px) sans défilement : ${Math.round(box.width)} × ${Math.round(box.height)}, contenu ${body[0]} px dans ${body[1]}`, inside(box) && body[0] <= body[1], { box, body });
  check(`[${tag}] dialogue modal nommé « ${words.title} » par son titre`, await page.$eval(BOX, el => el.getAttribute('role') === 'dialog' && el.getAttribute('aria-modal') === 'true'
    && document.getElementById(el.getAttribute('aria-labelledby')).textContent === el.querySelector('h3').textContent) && (await texts(page, `${BOX} h3`)).join() === words.title);
  const hex = await page.evaluate(() => { const input = document.querySelector('.cp-hex'); return { active: document.activeElement === input, value: input.value, from: input.selectionStart, to: input.selectionEnd }; });
  check(`[${tag}] le focus arrive sur le code hexadécimal, sélectionné en entier : taper remplace la couleur`, hex.active && hex.value === START.toUpperCase() && hex.from === 0 && hex.to === hex.value.length, hex);
  const fields = await fieldsOf(page);
  check(`[${tag}] le code et les trois champs disent la couleur de départ : ${START.toUpperCase()}, 59, 130, 246`, fields.hex === START.toUpperCase() && fields.rgb.join() === '59,130,246', fields);
  const names = await page.$$eval(`${BOX} .cp-channel`, nodes => nodes.map(node => `${node.querySelector('span').textContent}:${node.querySelector('input').getAttribute('aria-label')}`));
  check(`[${tag}] les champs de couleur : ${words.letters.join(', ')} à l'écran, ${words.channels.join(', ')} pour les lecteurs d'écran`, names.join('|') === words.letters.map((letter, at) => `${letter}:${words.channels[at]}`).join('|'), names);
  const chips = [await backgroundOf(page, `${BOX} .cp-chip-before`), await backgroundOf(page, `${BOX} .cp-chip-after`)];
  check(`[${tag}] l'aperçu montre « ${words.current} » et « ${words.fresh} », tous deux sur la couleur de départ`, (await texts(page, `${BOX} .cp-caption`)).join('|') === `${words.current}|${words.fresh}` && chips.every(chip => chip === hexRgb(START)), chips);
  check(`[${tag}] les boutons : « ${words.cancel} » et « ${words.apply} » (activé)`, (await texts(page, `${MODAL} .pp-modal-actions button`)).join('|') === `${words.cancel}|${words.apply}` && await page.$eval(`${MODAL} .pp-modal-primary`, el => !el.disabled));
  check(`[${tag}] les cases « ${words.keep} » : le modèle est coché, le document ne l'est pas`, (await texts(page, `${BOX} .cp-keep legend`)).join() === words.keep
    && (await texts(page, `${BOX} .cp-keep-row`)).join('|') === `${words.model}|${words.shared}` && JSON.stringify(await page.$$eval(`${BOX} .cp-keep-row input`, boxes => boxes.map(item => item.checked))) === '[true,false]');
  check(`[${tag}] ouverte par « ${words.custom} », la fenêtre passe au-dessus du menu qui reste dessous`, await page.evaluate(([x, y]) => Boolean(document.elementFromPoint(x, y).closest('.pp-modal')), [30, 90])
    && !(await page.$eval(PANEL, el => el.hidden)));
  await press(page, 'Escape');
  check(`[${tag}] Échap ferme la fenêtre et rend le clavier à « ${words.custom} », le bouton qui l'a ouverte`, (await closed(page)) && (await focused(page)) === words.custom, await focused(page));
}

// Le code hexadécimal : une valeur lisible change la couleur sans réécrire le champ, une valeur illisible le marque et grise « Appliquer ».
async function dialogTyping(page, tag, words) {
  await openDialog(page);
  await page.keyboard.type('#1e8');
  const typed = await fieldsOf(page);
  check(`[${tag}] taper « #1e8 » : le champ reste « #1e8 » (on ne le réécrit pas pendant la frappe), l'aperçu devient #11ee88, les champs 17, 238, 136`, typed.hex === '#1e8' && typed.rgb.join() === '17,238,136'
    && (await backgroundOf(page, `${BOX} .cp-chip-after`)) === hexRgb('#11ee88'), typed);
  check(`[${tag}] l'aperçu « ${words.current} » garde la couleur de départ`, (await backgroundOf(page, `${BOX} .cp-chip-before`)) === hexRgb(START));
  await press(page, 'Backspace');
  const bad = await page.evaluate(() => ({ invalid: document.querySelector('.cp-hex').getAttribute('aria-invalid'), hint: document.querySelector('.cp-hint').textContent, disabled: document.querySelector('.pp-modal-primary').disabled }));
  check(`[${tag}] « #1e » est illisible : champ marqué, phrase d'aide « ${words.hint} », « ${words.apply} » grisé`, bad.invalid === 'true' && bad.hint === words.hint && bad.disabled, bad);
  check(`[${tag}] l'aperçu garde la dernière couleur lisible (#11ee88)`, (await backgroundOf(page, `${BOX} .cp-chip-after`)) === hexRgb('#11ee88'));
  const before = (await results(page)).length;
  await press(page, 'Enter');
  await click(page, `${MODAL} .pp-modal-primary`);
  check(`[${tag}] Entrée et un clic sur « ${words.apply} » grisé ne valident rien : la fenêtre reste ouverte`, !(await closed(page)) && (await results(page)).length === before);
  await click(page, `${BOX} .cp-hex`);
  await press(page, 'End');
  await page.keyboard.type('8');
  const good = await page.evaluate(() => ({ invalid: document.querySelector('.cp-hex').hasAttribute('aria-invalid'), hint: document.querySelector('.cp-hint').textContent, disabled: document.querySelector('.pp-modal-primary').disabled }));
  check(`[${tag}] « #1e8 » redevient lisible : marque et phrase retirées, « ${words.apply} » dégrisé`, !good.invalid && good.hint === '' && !good.disabled, good);
  await press(page, 'Tab');
  check(`[${tag}] en quittant le champ, le code reprend la forme de la couleur : « #11EE88 »`, (await fieldsOf(page)).hex === '#11EE88' && (await stopOf(page)) === 'canal 1');
  await press(page, 'Escape');
}

// Les trois champs rouge, vert, bleu : la frappe, une valeur hors de 0 à 255, les flèches du champ.
async function dialogChannels(page, tag, words) {
  const red = `${BOX} .cp-channel:nth-child(1) input`;
  await openDialog(page);
  await click(page, red);
  await press(page, 'Control+A');
  await page.keyboard.type('255');
  const set = await fieldsOf(page);
  check(`[${tag}] taper 255 dans le champ ${words.channels[0]} : le code devient #FF82F6 et l'aperçu avec, le champ garde « 255 »`, set.hex === '#FF82F6' && set.rgb.join() === '255,130,246' && (await backgroundOf(page, `${BOX} .cp-chip-after`)) === hexRgb('#ff82f6'), set);
  await page.keyboard.type('0');
  const over = await page.evaluate(() => ({ invalid: document.querySelector('.cp-channel input').getAttribute('aria-invalid'), disabled: document.querySelector('.pp-modal-primary').disabled }));
  check(`[${tag}] 2550 est hors de 0 à 255 : champ marqué, « ${words.apply} » grisé, l'aperçu garde #ff82f6`, over.invalid === 'true' && over.disabled && (await backgroundOf(page, `${BOX} .cp-chip-after`)) === hexRgb('#ff82f6'), over);
  await press(page, 'Control+A');
  await page.keyboard.type('17');
  await press(page, 'ArrowUp');
  const fixed = await fieldsOf(page);
  check(`[${tag}] 17 est lisible : tout reprend vie ; la flèche haut du champ passe à 18 et le code à #1282F6`, fixed.rgb[0] === '18' && fixed.hex === '#1282F6' && await page.$eval(`${MODAL} .pp-modal-primary`, el => !el.disabled), fixed);
  await press(page, 'Escape');
}

// Le curseur de teinte et le carré : à la souris (clic, glissement au-delà du bord), au clavier (flèches, Maj).
async function dialogPointer(page, tag, words) {
  const area = `${BOX} .cp-area`;
  const hue = `${BOX} .cp-hue`;
  const percentages = async () => numbers(await page.$eval(area, el => el.getAttribute('aria-valuetext')));
  const hexNow = async () => (await fieldsOf(page)).hex.toLowerCase();
  const drag = async (to, from) => {
    const box = await rect(page, area);
    await page.mouse.move(from ? box.x + box.width * from[0] : box.x + box.width / 2, from ? box.y + box.height * from[1] : box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1], { steps: 4 });
    await page.mouse.up();
  };
  await openDialog(page);
  const slider = await rect(page, hue);
  await page.mouse.click(slider.x + slider.width / 3, slider.y + slider.height / 2);
  const degrees = Number(await page.$eval(hue, el => el.value));
  check(`[${tag}] un clic au tiers du curseur de teinte met la teinte vers 120° (${degrees}°) et le carré en prend la couleur`, Math.abs(degrees - 120) <= 12
    && (await page.$eval(area, el => el.style.getPropertyValue('--hue'))) === `hsl(${degrees}, 100%, 50%)`);
  await press(page, 'Home');
  check(`[${tag}] Début sur le curseur : teinte 0° (rouge)`, (await page.$eval(hue, el => el.value)) === '0');
  await drag([1.3, -0.3], [0.5, 0.5]);
  check(`[${tag}] glisser dans le carré au-delà de son coin haut droit borne la couleur : rouge franc #ff0000`, (await hexNow()) === '#ff0000', await hexNow());
  await drag([-0.3, 1.3], [0.5, 0.5]);
  check(`[${tag}] au-delà du coin bas gauche : noir #000000`, (await hexNow()) === '#000000', await hexNow());
  await drag([-0.3, -0.3], [0.5, 0.5]);
  check(`[${tag}] au-delà du coin haut gauche : blanc #ffffff`, (await hexNow()) === '#ffffff', await hexNow());
  const thumb = await rect(page, `${BOX} .cp-thumb`);
  const square = await rect(page, area);
  check(`[${tag}] le curseur du carré est dans le coin haut gauche (à 1 px)`, Math.abs(thumb.x + thumb.width / 2 - square.x) <= 1 && Math.abs(thumb.y + thumb.height / 2 - square.y) <= 1, { thumb, square });
  await page.mouse.move(square.x + square.width * 0.8, square.y + square.height * 0.8);
  check(`[${tag}] le bouton relâché, le carré ne suit plus la souris`, (await hexNow()) === '#ffffff');
  await page.mouse.click(square.x + square.width / 2, square.y + square.height / 2);
  const middle = ColorMath.rgbToHsv(ColorMath.toRgb(await hexNow()));
  check(`[${tag}] un clic au centre du carré : saturation et luminosité vers 50 % (${Math.round(middle.s * 100)} %, ${Math.round(middle.v * 100)} %)`, Math.abs(middle.s - 0.5) <= 0.03 && Math.abs(middle.v - 0.5) <= 0.03, middle);
  check(`[${tag}] le clic donne le clavier au carré`, (await stopOf(page)) === 'carré');
  await drag([-0.3, -0.3], [0.5, 0.5]);
  for (let i = 0; i < 5; i++) await press(page, 'ArrowRight');
  await press(page, 'Shift+ArrowRight');
  await press(page, 'ArrowDown');
  await press(page, 'Shift+ArrowDown');
  const keys = await percentages();
  check(`[${tag}] au clavier : flèche = 1 %, Maj + flèche = 10 % ; depuis (0 %, 100 %) : 5 × droite, Maj + droite, bas, Maj + bas -> saturation 15 %, luminosité 89 %`, keys.join() === '15,89', keys);
  await press(page, 'ArrowUp');
  await press(page, 'ArrowLeft');
  check(`[${tag}] haut et gauche reviennent d'un pas`, (await percentages()).join() === '14,90', await percentages());
  const text = await page.$eval(area, el => [el.getAttribute('aria-valuetext'), el.getAttribute('aria-valuenow')]);
  check(`[${tag}] le carré se lit « ${text[0]} » (aria-valuetext) et rend la saturation (${text[1]})`, text[0] === words.area(14, 90) && text[1] === '14', text);
  await press(page, 'Escape');
}

// Le clavier de la fenêtre, les sorties, et les cases « garder » dont la fenêtre se souvient.
async function dialogKeys(page, tag, words) {
  await openDialog(page);
  const order = [];
  for (let i = 0; i < 10; i++) { await press(page, 'Tab'); order.push(await stopOf(page)); }
  const expected = ['canal 1', 'canal 2', 'canal 3', 'case model', 'case document', words.cancel, words.apply, 'carré', 'teinte', 'code'];
  check(`[${tag}] Tab tourne dans la fenêtre : 3 canaux, 2 cases, ${words.cancel}, ${words.apply}, puis carré, teinte et code, sans en sortir`, order.join('|') === expected.join('|'), order);
  await press(page, 'Shift+Tab');
  check(`[${tag}] Maj+Tab depuis le code va à la teinte`, (await stopOf(page)) === 'teinte');
  await press(page, 'Escape');
  check(`[${tag}] Échap ferme la fenêtre sans rien appliquer (« close » seul) et rend le clavier au bouton qui l'a ouverte`, (await closed(page)) && (await lastResult(page)).name === 'close' && (await results(page)).filter(item => item.name === 'apply').length === 0 && (await focused(page)) === 'open-window');

  await openDialog(page);
  await page.keyboard.type('#1e8');
  await press(page, 'Enter');
  const done = (await results(page)).slice(-2);
  check(`[${tag}] Entrée dans le code applique : « apply » (#11ee88, la rangée du modèle) puis « close » ; la page prend la couleur et le menu garde la sienne`, done[0].name === 'apply' && done[0].value.color === '#11ee88'
    && done[0].value.scopes.join() === 'model' && done[1].name === 'close' && (await closed(page)) && (await backgroundOf(page, '#current')) === hexRgb('#11ee88'), done);

  await openDialog(page);
  check(`[${tag}] à la réouverture, la couleur de départ est celle d'avant (#11EE88)`, (await fieldsOf(page)).hex === '#11EE88' && (await backgroundOf(page, `${BOX} .cp-chip-before`)) === hexRgb('#11ee88'));
  await click(page, `${BOX} .cp-keep-row:nth-child(3)`);
  await click(page, `${MODAL} .pp-modal-primary`);
  const both = (await results(page)).slice(-2)[0];
  check(`[${tag}] cocher « ${words.shared} » puis « ${words.apply} » à la souris : les deux rangées reçoivent la couleur`, both.name === 'apply' && both.value.scopes.join() === 'model,document', both);

  await openDialog(page);
  const kept = await page.$$eval(`${BOX} .cp-keep-row input`, boxes => boxes.map(item => item.checked));
  check(`[${tag}] la fenêtre se souvient des cases : les deux sont cochées à la réouverture`, JSON.stringify(kept) === '[true,true]', kept);
  await click(page, `${BOX} .cp-keep-row:nth-child(2)`);
  await click(page, `${BOX} .cp-keep-row:nth-child(3)`);
  await click(page, `${MODAL} .pp-modal-actions button:first-of-type`);
  const cancelled = (await results(page)).slice(-1)[0];
  check(`[${tag}] « ${words.cancel} » à la souris : « close » seul`, cancelled.name === 'close' && (await closed(page)));
  await openDialog(page);
  const memory = await page.$$eval(`${BOX} .cp-keep-row input`, boxes => boxes.map(item => item.checked));
  check(`[${tag}] les cases décochées puis abandonnées restent décochées à la réouverture : la dernière réponse de la personne vaut, pas le réglage de l'app`, JSON.stringify(memory) === '[false,false]', memory);
  await press(page, 'Enter');
  check(`[${tag}] sans case cochée, Entrée applique pour aucune rangée (scopes vide)`, (await results(page)).slice(-2)[0].value.scopes.length === 0, (await results(page)).slice(-2)[0]);
}

// Les couleurs de la fenêtre telles que le navigateur les rend : 4,5:1 au moins pour tout texte, y compris la phrase d'aide rouge.
async function dialogContrast(page, tag, system) {
  await openDialog(page);
  await page.keyboard.type('#1');
  const wrong = [];
  for (const selector of ['h3', '.cp-label', '.cp-caption', '.cp-hint', '.cp-keep legend', '.cp-keep-row span', '.cp-channel span']) {
    const color = await page.$eval(`${BOX} ${selector}`, el => getComputedStyle(el).color);
    const value = contrastOf(color, await backdrop(page, `${BOX} ${selector}`));
    if (value < 4.5) wrong.push({ selector, value });
  }
  for (const selector of ['.cp-hex', '.cp-number']) {
    const { color, background } = await paint(page, `${BOX} ${selector}`);
    const value = contrastOf(color, background);
    if (value < 4.5) wrong.push({ selector, value });
  }
  check(`[${tag}] contraste des textes de la fenêtre (titre, libellés, aperçu, phrase d'aide, cases, saisies) : 4,5:1 au moins`, wrong.length === 0, wrong);
  const tokens = system === 'dark' ? dark : light;
  check(`[${tag}] le cadre est sur --surface, le champ marqué illisible a le liseré de danger`, (await backgroundOf(page, BOX)) === hexRgb(tokens['--surface'])
    && (await page.$eval(`${BOX} .cp-hex`, el => getComputedStyle(el).borderTopColor)) === hexRgb(tokens['--danger']));
  await press(page, 'Escape');
}

export async function colorDialog(env, system, locale) {
  const lang = locale.startsWith('fr') ? 'fr' : 'en';
  const words = WORDS[lang];
  const tag = tagOf(system, lang);
  const steps = [page => dialogStart(page, tag, words), page => dialogTyping(page, tag, words), page => dialogChannels(page, tag, words), page => dialogPointer(page, tag, words), page => dialogKeys(page, tag, words), page => dialogContrast(page, tag, system)];
  for (const step of steps) {
    const { page, warnings } = await openPage(env, { colorScheme: system, locale, path: 'couleur.html' });
    await step(page);
    if (step === steps[0]) { await openDialog(page); await shot(env, page, system, lang, 'fenetre'); }
    check(`[${tag}] aucun avertissement de la console`, warnings.length === 0, warnings);
    await page.context().close();
  }
}
