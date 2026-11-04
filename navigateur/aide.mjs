// Outils des essais du navigateur : le serveur du dépôt, Playwright, la sortie « OK / ÉCHEC » et les gestes à la vraie souris et au vrai clavier (jamais dispatchEvent : un bouton
// recouvert par un voile ne se clique pas, une touche prise par un autre écouteur n'arrive pas, et c'est ce que les essais doivent voir).
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
// Playwright : celui du dossier du dépôt si on l'y a installé, sinon celui du conteneur du cloud.
const playwright = (() => { try { return require('playwright'); } catch (error) { return require('/opt/node22/lib/node_modules/playwright'); } })();
export const { chromium } = playwright;

export const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/[\\/]$/, '');

// Sortie des essais : une ligne « OK » ou « ÉCHEC » par vérification, et le code de sortie du script suit.
export const tally = { ok: 0, failed: 0 };
export const say = (...parts) => process.stdout.write(parts.map(part => (typeof part === 'string' ? part : JSON.stringify(part))).join(' ') + '\n');
export function check(label, ok, detail = '') {
  tally[ok ? 'ok' : 'failed'] += 1;
  say(ok ? 'OK    ' : 'ÉCHEC ', label, ok || detail === '' ? '' : (typeof detail === 'string' ? detail : JSON.stringify(detail)));
  if (!ok) process.exitCode = 1;
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };

// Sert le dépôt tel quel, sans cache. Comme GitHub Pages, ni fichier ni dossier dont le nom commence par « _ » ou « . », et l'en-tête CORS ouvert : un module chargé par le cadre
// isolé d'une app (origine opaque) ne passe pas sans lui.
export function serve() {
  const server = http.createServer(async (request, response) => {
    const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = normalize(join(ROOT, path));
    const hidden = path.split('/').some(part => part.startsWith('_') || part.startsWith('.'));
    try {
      if (hidden || !file.startsWith(ROOT + sep)) throw new Error('refusé');
      const data = await readFile(file);
      response.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
      response.end(data);
    } catch (error) {
      response.writeHead(404);
      response.end('introuvable');
    }
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() })));
}

// Une page d'essai dans un contexte neuf (stockage vide) au format du panneau de Grist. Rend la page et les avertissements de sa console ; les erreurs de la console, les erreurs de
// page (dont les refus de la politique de sécurité du contenu) et les requêtes hors du serveur local vont dans `env`, que le script vérifie à la fin.
export async function openPage(env, { colorScheme = 'light', locale = 'fr-FR', search = '', hash = '', init, path = 'page.html' } = {}) {
  const context = await env.browser.newContext({ viewport: { width: 700, height: 400 }, colorScheme, locale });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const warnings = [];
  page.on('pageerror', error => env.problems.push(`erreur de page : ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') env.problems.push(`console : ${message.text()}`);
    if (message.type() === 'warning') warnings.push(message.text());
  });
  page.on('request', request => { if (!request.url().startsWith(env.origin) && !request.url().startsWith('data:')) env.external.push(request.url()); });
  await page.goto(`${env.origin}/navigateur/${path}${search}${hash}`);
  await page.waitForFunction(() => window.kit && window.kit.I18n);
  return { page, warnings };
}

// Un clic de souris au centre de l'élément, là où il est vraiment : s'il est sous un voile, c'est le voile qui reçoit le clic.
export async function click(page, selector) {
  const box = await page.locator(selector).boundingBox();
  if (!box) throw new Error(`introuvable ou caché : ${selector}`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

export const press = (page, key) => page.keyboard.press(key);
export const rect = (page, selector) => page.$eval(selector, el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; });
export const displayOf = (page, selector) => page.$eval(selector, el => getComputedStyle(el).display);
// Qui a le focus : son id, à défaut son texte (les boutons d'une saisie n'ont pas d'id).
export const focused = page => page.evaluate(() => { const el = document.activeElement; return el ? (el.id || el.textContent.trim() || el.tagName) : null; });
export const results = page => page.evaluate(() => window.kit.results.slice());
export const lastResult = async page => { const all = await results(page); return all[all.length - 1]; };
// Les libellés des boutons visibles de la saisie / confirmation, de gauche à droite.
export const dialogButtons = page => page.$$eval('#pp-dialog-modal .pp-modal-actions button:not([hidden])', buttons => buttons.map(button => button.textContent));
// La couleur du texte et celle du fond d'un élément, telles que le navigateur les calcule.
export const paint = (page, selector) => page.$eval(selector, el => { const s = getComputedStyle(el); return { color: s.color, background: s.backgroundColor }; });
// « rgb(47, 111, 237) » ou « rgba(15, 23, 42, 0.45) » en nombres.
export const numbers = text => (text.match(/[\d.]+/g) || []).map(Number);

// Les textes visibles qui répondent à `selectors`, chacun avec sa couleur et le fond que l'œil voit derrière lui : les fonds de tout ce qui est empilé à cet endroit, du dessous au dessus (un fond
// peut être un autre élément que le parent : la cellule d'un jour sous son numéro). Un texte hors de l'écran ou recouvert n'est pas lu. Rend { selector, text, color, background } en [r, g, b],
// à donner à ratio() de test/jetons.mjs.
export function visibleTexts(page, selectors) {
  return page.evaluate(list => {
    const parse = text => { const n = (text.match(/[\d.]+/g) || []).map(Number); return { r: n[0], g: n[1], b: n[2], a: n.length > 3 ? n[3] : 1 }; };
    const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
    const out = [];
    for (const selector of list) {
      for (const el of document.querySelectorAll(selector)) {
        const box = el.getBoundingClientRect();
        const text = (el.value || el.textContent).trim();
        if (!text || !box.width || !box.height) continue;
        const stack = document.elementsFromPoint(box.x + box.width / 2, box.y + box.height / 2);
        const at = stack.findIndex(node => el.contains(node));
        if (at === -1) continue;
        let background = { r: 255, g: 255, b: 255, a: 1 };
        for (const node of stack.slice(at).reverse()) background = over(parse(getComputedStyle(node).backgroundColor), background);
        const color = over(parse(getComputedStyle(el).color), background);
        out.push({ selector, text: text.slice(0, 24), color: [color.r, color.g, color.b].map(Math.round), background: [background.r, background.g, background.b].map(Math.round) });
      }
    }
    return out;
  }, selectors);
}
