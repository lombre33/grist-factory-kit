import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliser, normaliserLigne, couleurValide } from '../js/calendrier/noyau/evenements.js';

const un = ligne => normaliserLigne(ligne).evenement;
const raison = ligne => normaliserLigne(ligne).erreur;

test('une ligne complète devient un événement', () => {
  const e = un({ id: 7, titre: 'Rédiger', debut: '2026-11-03', fin: '2026-11-05', statut: 'En cours', couleur: { fond: '#aabbcc', texte: '#000' }, responsables: ['Personne A', 'Personne B'] });
  assert.deepEqual(e, {
    id: 7, titre: 'Rédiger', statut: 'En cours', couleur: { fond: '#aabbcc', texte: '#000' }, responsables: ['Personne A', 'Personne B'], modifiable: true,
    debut: '2026-11-03', fin: '2026-11-05', heureDebut: null, heureFin: null, avecHeure: false, sansDate: false,
  });
});

test('début seul ou fin seule : un événement d\'un jour', () => {
  assert.deepEqual([un({ id: 1, debut: '2026-11-03' }).debut, un({ id: 1, debut: '2026-11-03' }).fin], ['2026-11-03', '2026-11-03']);
  assert.deepEqual([un({ id: 1, fin: '2026-11-04' }).debut, un({ id: 1, fin: '2026-11-04' }).fin], ['2026-11-04', '2026-11-04']);
  assert.equal(un({ id: 1, debut: '2026-11-03', fin: '' }).fin, '2026-11-03');
  assert.equal(un({ id: 1, debut: null, fin: '2026-11-04' }).debut, '2026-11-04');
});

test('ni début ni fin : le plateau « Sans date »', () => {
  for (const ligne of [{ id: 1 }, { id: 1, debut: null, fin: null }, { id: 1, debut: '', fin: undefined }]) {
    const e = un(ligne);
    assert.equal(e.sansDate, true);
    assert.equal(e.debut, null);
    assert.equal(e.fin, null);
  }
});

test('une date illisible écarte la ligne, jamais corrigée en silence', () => {
  for (const ligne of [{ id: 1, debut: '03/11/2026' }, { id: 1, debut: '2026-02-30' }, { id: 1, debut: '2026-11-03', fin: 'demain' }, { id: 1, fin: 17 }, { id: 1, debut: '2026-11-03T25:00' }]) {
    assert.equal(raison(ligne), 'date-illisible', JSON.stringify(ligne));
  }
});

test('une fin avant le début écarte la ligne ; le même jour, avec heures, se compare aux heures', () => {
  assert.equal(raison({ id: 1, debut: '2026-11-05', fin: '2026-11-04' }), 'fin-avant-debut');
  assert.equal(raison({ id: 1, debut: '2026-11-05T10:00', fin: '2026-11-05T09:00' }), 'fin-avant-debut');
  assert.equal(un({ id: 1, debut: '2026-11-05T09:00', fin: '2026-11-05T10:00' }).heureFin, '10:00');
  assert.equal(un({ id: 1, debut: '2026-11-05', fin: '2026-11-05' }).fin, '2026-11-05');
  assert.equal(un({ id: 1, debut: '2026-11-05T09:00', fin: '2026-11-05T09:00' }).avecHeure, true);
});

test('les heures : gardées par défaut, ignorées quand la colonne n\'en a pas (avecHeure: false)', () => {
  const avec = un({ id: 1, debut: '2026-11-05T09:00', fin: '2026-11-05T10:30' });
  assert.deepEqual([avec.avecHeure, avec.heureDebut, avec.heureFin], [true, '09:00', '10:30']);
  const sans = un({ id: 1, debut: '2026-11-05T09:00', fin: '2026-11-06T10:30', avecHeure: false });
  assert.deepEqual([sans.avecHeure, sans.heureDebut, sans.heureFin, sans.debut, sans.fin], [false, null, null, '2026-11-05', '2026-11-06']);
});

test('modifiable : vrai sauf si la ligne dit faux', () => {
  assert.equal(un({ id: 1, debut: '2026-11-05' }).modifiable, true);
  assert.equal(un({ id: 1, debut: '2026-11-05', modifiable: false }).modifiable, false);
  assert.equal(un({ id: 1, debut: '2026-11-05', modifiable: 0 }).modifiable, true);
});

test('titre, statut et responsables : des textes, jamais autre chose', () => {
  const e = un({ id: 1, titre: 12, statut: null, responsables: 'Personne A', debut: '2026-11-05' });
  assert.equal(e.titre, '12');
  assert.equal(e.statut, '');
  assert.deepEqual(e.responsables, ['Personne A']);
  assert.deepEqual(un({ id: 1, responsables: ['A', '', null, 3] }).responsables, ['A', '3']);
  assert.deepEqual(un({ id: 1, responsables: null }).responsables, []);
  assert.equal(un({ id: 1 }).titre, '');
});

test('couleurValide : des couleurs écrites comme Grist les donne, rien d\'exécutable', () => {
  assert.deepEqual(couleurValide({ fond: '#FF0000', texte: '#fff' }), { fond: '#FF0000', texte: '#fff' });
  assert.deepEqual(couleurValide({ fond: 'rgb(1, 2, 3)' }), { fond: 'rgb(1, 2, 3)', texte: null });
  assert.deepEqual(couleurValide({ texte: 'hsla(10, 20%, 30%, 0.5)' }), { fond: null, texte: 'hsla(10, 20%, 30%, 0.5)' });
  for (const faux of [null, undefined, 'red', {}, { fond: 'red' }, { fond: 'url(http://x)' }, { fond: '#fff; background: url(x)' }, { fond: 'rgb(1,2,3);x' }, 5]) assert.equal(couleurValide(faux), null, JSON.stringify(faux));
});

test('normaliser : sépare événements, plateau « Sans date » et lignes écartées, dans l\'ordre reçu', () => {
  const { evenements, sansDate, invalides } = normaliser([
    { id: 1, debut: '2026-11-03' }, { id: 2 }, { id: 3, debut: 'x' }, { id: 4, debut: '2026-11-05', fin: '2026-11-01' }, { id: 5, fin: '2026-11-09' }, { id: 6, debut: '', fin: '' },
  ]);
  assert.deepEqual(evenements.map(e => e.id), [1, 5]);
  assert.deepEqual(sansDate.map(e => e.id), [2, 6]);
  assert.deepEqual(invalides, [{ id: 3, raison: 'date-illisible' }, { id: 4, raison: 'fin-avant-debut' }]);
});

test('normaliser : identifiant absent ou en double, lignes absentes, entrée qui n\'est pas une liste', () => {
  const { evenements, invalides } = normaliser([{ id: 1, debut: '2026-11-03' }, { id: 1, debut: '2026-11-04' }, { id: '1', debut: '2026-11-05' }, { debut: '2026-11-03' }, { id: null }, null, { id: 0, debut: '2026-11-06' }]);
  assert.deepEqual(evenements.map(e => e.id), [1, 0]);
  assert.deepEqual(invalides.map(i => i.raison), ['id-en-double', 'id-en-double', 'id-manquant', 'id-manquant', 'id-manquant']);
  for (const entree of [undefined, null, 'abc', 12, {}]) assert.deepEqual(normaliser(entree), { evenements: [], sansDate: [], invalides: [] });
});
