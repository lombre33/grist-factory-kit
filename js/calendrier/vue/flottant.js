// Poser une boîte flottante (saisie rapide, liste du jour) près d'une cellule, dans la couche qui couvre tout le calendrier, et la ramener dans le cadre si elle en sort.
export function poserPres(boite, couche, cellule, { decalage = 24, largeurMin = 0 } = {}) {
  const racine = couche.getBoundingClientRect();
  const rect = cellule.getBoundingClientRect();
  couche.append(boite);
  const largeur = Math.max(boite.offsetWidth, largeurMin, 0);
  const hauteur = boite.offsetHeight;
  const gauche = Math.min(Math.max(4, rect.left - racine.left), Math.max(4, racine.width - largeur - 4));
  const haut = Math.min(rect.top - racine.top + decalage, Math.max(4, racine.height - hauteur - 4));
  boite.style.setProperty('--cal-x', `${Math.round(gauche)}px`);
  boite.style.setProperty('--cal-y', `${Math.round(Math.max(4, haut))}px`);
  boite.style.setProperty('--cal-l', `${Math.round(Math.max(largeurMin, Math.min(rect.width, racine.width - 8)))}px`);
}
