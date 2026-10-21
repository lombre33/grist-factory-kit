// Un module du kit qui garde un état n'existe qu'une fois par page. Le charger par deux adresses (un `?v=` sur l'un et pas sur l'autre) en ferait deux : le deuxième le dit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from '../js/once.js';

function warningsOf(run) {
  const warnings = [];
  const original = console.warn;
  console.warn = message => warnings.push(message);
  return Promise.resolve(run()).then(() => warnings).finally(() => { console.warn = original; });
}

test('le premier chargement ne dit rien, le deuxième le signale avec les deux adresses', async () => {
  const warnings = await warningsOf(() => { once('essai', 'file:///a.js'); once('essai', 'file:///b.js?v=2'); });
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /essai est chargé deux fois/);
  assert.match(warnings[0], /a\.js/);
  assert.match(warnings[0], /b\.js\?v=2/);
});

test('deux modules différents ne se gênent pas', async () => {
  assert.deepEqual(await warningsOf(() => { once('un', 'file:///un.js'); once('deux', 'file:///deux.js'); }), []);
});

test('charger layers.js, theme.js, modal-base.js ou i18n.js par deux adresses est signalé', async () => {
  for (const name of ['layers', 'theme', 'modal-base', 'i18n']) {
    const warnings = await warningsOf(async () => {
      await import(`../js/${name}.js`);
      await import(`../js/${name}.js?v=autre`);
    });
    assert.equal(warnings.length, 1, `${name} : ${warnings.length} avertissement(s)`);
    assert.match(warnings[0], new RegExp(`${name} est chargé deux fois`));
  }
});
