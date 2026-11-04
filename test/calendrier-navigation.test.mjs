import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jourInitial, voisin, lignesDeLaVue, vueValide, VUES } from '../js/calendrier/noyau/navigation.js';

test('le calendrier s\'ouvre sur aujourd\'hui, pas sur la date du premier enregistrement', () => {
  assert.equal(jourInitial(undefined, new Date(2026, 10, 3, 10)), '2026-11-03');
  assert.equal(jourInitial(null, () => new Date(2027, 0, 1)), '2027-01-01');
  assert.equal(jourInitial('n\'importe quoi', new Date(2026, 10, 3)), '2026-11-03');
});

test('un jour demandé par l\'hôte est respecté', () => {
  assert.equal(jourInitial('2026-02-10', new Date(2026, 10, 3)), '2026-02-10');
});

test('vueValide : mois par défaut', () => {
  assert.deepEqual([...VUES], ['mois', 'semaine', 'jour']);
  assert.equal(vueValide('jour'), 'jour');
  assert.equal(vueValide('semaine'), 'semaine');
  for (const faux of ['annee', '', null, undefined, 3]) assert.equal(vueValide(faux), 'mois');
});

test('voisin : un mois ou une semaine plus loin', () => {
  assert.equal(voisin('mois', '2026-01-31', 1), '2026-02-28');
  assert.equal(voisin('mois', '2026-01-15', -1), '2025-12-15');
  assert.equal(voisin('semaine', '2026-12-30', 1), '2027-01-06');
  assert.equal(voisin('semaine', '2026-11-03', -1), '2026-10-27');
  assert.equal(voisin('jour', '2026-12-31', 1), '2027-01-01');
  assert.equal(voisin('jour', '2026-03-01', -1), '2026-02-28');
});

test('lignesDeLaVue : un mois en lignes, une semaine en une ligne qui commence le lundi', () => {
  assert.equal(lignesDeLaVue('mois', '2026-11-03').length, 6);
  const semaine = lignesDeLaVue('semaine', '2026-11-04');
  assert.equal(semaine.length, 1);
  assert.equal(semaine[0][0].jour, '2026-11-02');
  assert.equal(semaine[0][6].jour, '2026-11-08');
  assert.equal(lignesDeLaVue('semaine', '2026-11-04', 0)[0][0].jour, '2026-11-01');
  assert.deepEqual(lignesDeLaVue('jour', '2026-11-04'), [[{ jour: '2026-11-04', dansLeMois: true }]]);
});
