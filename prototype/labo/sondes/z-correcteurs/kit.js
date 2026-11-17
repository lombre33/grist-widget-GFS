// Sonde ZL « kit » du labo (contrats 5.2, point 13) : la même app que `correcteurs.js`, mais qui coupe les correcteurs par le VRAI module du kit (`Correcteurs.start()`, js/correcteurs.js du sous-module `kit/`, branché sur
// le vrai `GfsLink`), au lieu d'une marque posée à la main. Elle écrit dans `document.body.dataset.sonde` la même forme que `correcteurs.js` (`contextes`, `evenements`, `marques`) : ce que le kit a lu de GFS et la marque
// qu'il a vraiment posée sur les trois zones. `window.addZone(préfixe)` fait naître une fenêtre avec deux zones de plus, comme une app qui ouvre une boîte de saisie.
import { GfsLink } from '../../../kit/js/gfs-link.js';
import { Correcteurs } from '../../../kit/js/correcteurs.js';

const received = { contextes: [], evenements: [], marques: null };
const read = id => { const node = document.getElementById(id); return node ? node.getAttribute('data-lt-active') : 'absent'; };
const publish = () => {
  received.marques = { e1: read('e1'), i1: read('i1'), t1: read('t1') };
  received.secret = read('secret');
  received.wrap = read('wrap');
  document.body.dataset.sonde = JSON.stringify(received);
};

window.addZone = (prefix) => {
  const dialog = document.createElement('div');
  dialog.id = `${prefix}-dialog`;
  const area = document.createElement('textarea');
  area.id = `${prefix}-area`;
  const holder = document.createElement('div');
  const editor = document.createElement('div');
  editor.id = `${prefix}-editor`;
  editor.setAttribute('contenteditable', 'true');
  holder.append(editor);
  dialog.append(area, holder);
  document.body.append(dialog);
};
window.readZone = read;

const pose = Correcteurs.start();
// Le contexte d'abord (ce que le kit en a lu), puis les changements un par un ; la marque est posée avant que la sonde ne la relève (le kit s'est abonné le premier).
pose.ready.then(() => {
  received.contextes.push(GfsLink.correcteurs());
  GfsLink.onCorrecteurs((value) => { received.evenements.push({ correcteurs: value }); publish(); });
  publish();
});
publish();
