import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deplacer } from '../js/calendrier/noyau/deplacement.js';
import { normaliser } from '../js/calendrier/noyau/evenements.js';

const un = ligne => normaliser([ligne]);
const evenement = ligne => un(ligne).evenements[0];

test('un jour : il suffit de le poser sur un autre jour', () => {
  assert.deepEqual(deplacer(evenement({ id: 1, debut: '2026-11-03' }), '2026-11-03', '2026-11-10'), { id: 1, debut: '2026-11-10', fin: '2026-11-10' });
  assert.deepEqual(deplacer(evenement({ id: 1, debut: '2026-11-03' }), '2026-11-03', '2026-11-01'), { id: 1, debut: '2026-11-01', fin: '2026-11-01' });
});

test('plusieurs jours : l\'écart entre début et fin est conservé, quel que soit le jour saisi', () => {
  const e = evenement({ id: 1, debut: '2026-11-03', fin: '2026-11-06' });
  assert.deepEqual(deplacer(e, '2026-11-03', '2026-11-10'), { id: 1, debut: '2026-11-10', fin: '2026-11-13' });
  assert.deepEqual(deplacer(e, '2026-11-05', '2026-11-10'), { id: 1, debut: '2026-11-08', fin: '2026-11-11' });
  assert.deepEqual(deplacer(e, '2026-11-06', '2026-11-06'), null);
});

test('le saisi hors de l\'événement : le premier jour est pris', () => {
  const e = evenement({ id: 1, debut: '2026-11-03', fin: '2026-11-06' });
  assert.deepEqual(deplacer(e, '2026-11-20', '2026-11-10'), { id: 1, debut: '2026-11-10', fin: '2026-11-13' });
  assert.deepEqual(deplacer(e, '2026-11-01', '2026-11-03'), null);
});

test('rien ne change quand le jour de dépôt est celui de la saisie', () => {
  assert.equal(deplacer(evenement({ id: 1, debut: '2026-11-03', fin: '2026-11-05' }), '2026-11-04', '2026-11-04'), null);
});

test('l\'écart survit aux fins de mois, d\'année et de février bissextile', () => {
  assert.deepEqual(deplacer(evenement({ id: 1, debut: '2026-12-30', fin: '2027-01-02' }), '2026-12-30', '2027-02-26'), { id: 1, debut: '2027-02-26', fin: '2027-03-01' });
  assert.deepEqual(deplacer(evenement({ id: 1, debut: '2024-02-27', fin: '2024-03-01' }), '2024-02-27', '2024-02-28'), { id: 1, debut: '2024-02-28', fin: '2024-03-02' });
  assert.deepEqual(deplacer(evenement({ id: 1, debut: '2026-03-28', fin: '2026-03-30' }), '2026-03-28', '2026-03-29'), { id: 1, debut: '2026-03-29', fin: '2026-03-31' });
});

test('les heures sont gardées', () => {
  const e = evenement({ id: 1, debut: '2026-11-03T09:00', fin: '2026-11-04T17:30' });
  assert.deepEqual(deplacer(e, '2026-11-03', '2026-11-10'), { id: 1, debut: '2026-11-10T09:00', fin: '2026-11-11T17:30' });
});

test('une ligne sans date reçoit le jour de dépôt pour début et fin', () => {
  assert.deepEqual(deplacer(un({ id: 9 }).sansDate[0], null, '2026-11-12'), { id: 9, debut: '2026-11-12', fin: '2026-11-12' });
  assert.deepEqual(deplacer(un({ id: 9 }).sansDate[0], '2026-11-01', '2026-11-12'), { id: 9, debut: '2026-11-12', fin: '2026-11-12' });
});

test('une ligne non modifiable ne bouge pas, sans date comprise', () => {
  assert.equal(deplacer(evenement({ id: 1, debut: '2026-11-03', modifiable: false }), '2026-11-03', '2026-11-10'), null);
  assert.equal(deplacer(un({ id: 1, modifiable: false }).sansDate[0], null, '2026-11-10'), null);
});
