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

// Un appel qui porte un fichier (`ranger`, 5.4 point 9) est noté avec sa description — nom, taille, type, début des octets, et si c'est un vrai `File` — lue avant de le noter : le fichier
// lui-même ne traverse pas la lecture que l'essai fait de la page.
const carriesBlob = message => Boolean(message && message.args && typeof message.args === 'object' && Object.values(message.args).some(value => value instanceof Blob));
async function describe(message) {
  const args = { ...message.args };
  for (const [key, value] of Object.entries(args)) {
    if (value instanceof Blob) args[key] = { blob: true, fichier: value instanceof File, nom: value.name === undefined ? null : value.name, taille: value.size, type: value.type, debut: (await value.text()).slice(0, 12) };
  }
  return { ...message, args };
}

window.addEventListener('message', (event) => {
  const fromApp = Boolean(app) && event.source === app.contentWindow;
  const message = event.data;
  const note = data => received.push({ from: fromApp ? 'app' : 'autre', data });
  if (carriesBlob(message)) describe(message).then(note); else note(message);
  if (fromApp && message && message.type === 'appel' && message.nom === 'contexte') app.contentWindow.postMessage({ gfs: 0, type: 'reponse', id: message.id, data: CONTEXT }, '*');
});

app = isolated('app', 'gfs-cadre.html?gfs=0&language=fr');
isolated('voisin', 'gfs-voisin.html');

window.hote = {
  received: () => received.slice(),
  send: message => app.contentWindow.postMessage(message, '*'),
};
