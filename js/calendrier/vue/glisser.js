// Le glisser-déposer HTML5 des événements : des éléments qui ne sont pas des boutons (un <button draggable> ne glisse pas sous Firefox avant la 147, consigne 007 de GFS).

// Le jour de la colonne sous le curseur, dans une zone de sept colonnes égales.
export function jourSousLeCurseur(zone, jours, x) {
  const rect = zone.getBoundingClientRect();
  if (!rect.width) return jours[0];
  const colonne = Math.floor(((x - rect.left) / rect.width) * 7);
  return jours[Math.min(6, Math.max(0, colonne))];
}

// Rend un élément glissable : `glisse` garde ce qui est en cours de glissement ({ id, jourSaisi }), partagé par toutes les zones du calendrier.
export function rendreGlissable(element, { id, jours, zone, glisse }) {
  element.setAttribute('draggable', 'true');
  element.addEventListener('dragstart', evenement => {
    glisse.courant = { id, jourSaisi: jours && zone ? jourSousLeCurseur(zone, jours, evenement.clientX) : null };
    if (evenement.dataTransfer) {
      evenement.dataTransfer.effectAllowed = 'move';
      evenement.dataTransfer.setData('text/plain', String(id));
    }
    element.classList.add('cal-glisse');
  });
  element.addEventListener('dragend', () => {
    glisse.courant = null;
    element.classList.remove('cal-glisse');
  });
}

// Une zone de sept colonnes qui accepte un dépôt : `survol(jour | null)` pour surligner, `depose(jour)` au dépôt.
export function accepterDepots(zone, jours, glisse, { survol, depose }) {
  zone.addEventListener('dragover', evenement => {
    if (!glisse.courant) return;
    evenement.preventDefault();
    if (evenement.dataTransfer) evenement.dataTransfer.dropEffect = 'move';
    survol(jourSousLeCurseur(zone, jours, evenement.clientX));
  });
  zone.addEventListener('dragleave', evenement => {
    if (!zone.contains(evenement.relatedTarget)) survol(null);
  });
  zone.addEventListener('drop', evenement => {
    if (!glisse.courant) return;
    evenement.preventDefault();
    survol(null);
    depose(jourSousLeCurseur(zone, jours, evenement.clientX));
  });
}
