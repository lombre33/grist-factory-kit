// GFS joué par les essais du lien (navigateur/scenarios-gfs.mjs) : il pose le cadre de l'app isolé comme chez GFS (sandbox="allow-scripts", sans allow-same-origin), répond à son
// contexte, note tout message reçu (et de quel cadre il vient) et envoie au cadre ce que l'essai lui demande. Un second cadre isolé joue un cadre voisin qui écrit à l'app.
const CONTEXT = {
  contrat: 0, document: 'essai', acces: 'full', lectureSeule: false, langue: 'en',
  barre: { bord: 'gauche', epaisseur: 42, zone: { x: 0, y: 134, largeur: 42, hauteur: 132 } },
  stockage: { kit_theme: 'dark' }, extensions: [], bibliotheques: {},
};
const received = [];
let app = null;

function isolated(id, src) {
  const frame = document.createElement('iframe');
  frame.id = id;
  frame.title = id;
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.src = src;
  document.body.append(frame);
  return frame;
}

window.addEventListener('message', (event) => {
  const fromApp = Boolean(app) && event.source === app.contentWindow;
  received.push({ from: fromApp ? 'app' : 'autre', data: event.data });
  const message = event.data;
  if (fromApp && message && message.type === 'appel' && message.nom === 'contexte') app.contentWindow.postMessage({ gfs: 0, type: 'reponse', id: message.id, data: CONTEXT }, '*');
});

app = isolated('app', 'gfs-cadre.html?gfs=0&language=fr');
isolated('voisin', 'gfs-voisin.html');

window.hote = {
  received: () => received.slice(),
  send: message => app.contentWindow.postMessage(message, '*'),
};
