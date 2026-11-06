// Sonde J du labo (contrats 2.7 point 7, 5.4 point 12) : une app minimale qui fait ce que fera Publipostage+ pour joindre ses PDF à la cellule « Pièces jointes » d'une ligne. Elle demande `contexte`,
// puis, quand le labo le lui demande (`window.sondeJ`), fabrique les PDF DANS SON CADRE ISOLÉ (de vrais `File` de ce cadre, octets reçus du labo en base64) et appelle `joindre` chez GFS avec la demande
// qu'on lui donne. Chaque réponse de GFS, dans l'ordre où elle arrive, est écrite dans `document.body.dataset.sonde` (que le labo lit) : `{ ok: true, data }` ou `{ ok: false, code, message }`.
(function () {
  'use strict';
  const received = { contexte: false, resultats: [] };
  const waiting = new Map();
  let next = 10;
  const publish = () => { document.body.dataset.sonde = JSON.stringify(received); };
  const post = message => window.parent.postMessage(message, '*');

  window.addEventListener('message', event => {
    const msg = event.data;
    if (event.source !== window.parent || !msg || msg.gfs !== 0 || msg.mtype !== undefined) return;
    if (msg.type === 'reponse' && msg.id === 1) {
      received.contexte = true;
      document.getElementById('state').textContent = 'Prête à joindre';
      publish();
    } else if (msg.type === 'reponse' || msg.type === 'erreur') {
      const done = waiting.get(msg.id);
      if (done) { waiting.delete(msg.id); done(msg); }
    } else if (msg.type === 'appel') {
      post({ gfs: 0, type: 'erreur', id: msg.id, code: 'GFS_INCONNU', message: 'L\'appel « ' + msg.nom + ' » est inconnu de cette app.' });
    }
  });
  post({ gfs: 0, type: 'appel', id: 1, nom: 'contexte', args: {} });
  post({ mtype: 5 });
  post({ mtype: 4, data: { message: 'themeInitialized' } });

  const fileOf = (b64, name) => {
    const text = atob(b64);
    const bytes = new Uint8Array(text.length);
    for (let at = 0; at < text.length; at += 1) bytes[at] = text.charCodeAt(at);
    return new File([bytes], name, { type: 'application/pdf' });
  };

  const call = (label, args) => new Promise(resolve => {
    const id = next++;
    waiting.set(id, msg => {
      const result = msg.type === 'reponse' ? { label, ok: true, data: msg.data } : { label, ok: false, code: msg.code, message: msg.message };
      received.resultats.push(result);
      publish();
      resolve(result);
    });
    post({ gfs: 0, type: 'appel', id, nom: 'joindre', args });
  });

  // demande : { table, colonne, mode?, fichiers: [{ ligne, nom, b64, fichier? }] } -> la demande de l'app, avec de vrais `File` de ce cadre. `brut` : une demande donnée telle quelle.
  const request = demande => {
    if (demande.brut) return demande.brut;
    const args = { table: demande.table, colonne: demande.colonne, fichiers: demande.fichiers.map(item => ({ ligne: item.ligne, nom: item.nom, fichier: fileOf(item.b64, item.fichier || 'export.pdf') })) };
    if (demande.mode !== undefined) args.mode = demande.mode;
    return args;
  };

  window.sondeJ = { joindre: demande => call(demande.label || 'joindre', request(demande)) };
  publish();
}());
