// Sonde Z du labo (contrats 2.7 point 6, 5.4 point 9) : une app minimale qui fait ce que fera Publipostage+ pour ranger ses exports PDF dans GFS. Elle demande `contexte`, puis, quand le labo
// le lui demande (`window.sondeZ`), fabrique le PDF DANS SON CADRE ISOLÉ (un vrai `File` de ce cadre, octets reçus du labo en base64) et appelle `ranger` chez GFS avec la demande qu'on lui donne.
// Chaque réponse de GFS, dans l'ordre où elle arrive, est écrite dans `document.body.dataset.sonde` (que le labo lit) : `{ ok: true, data }` ou `{ ok: false, code, message }`.
(function () {
  'use strict';
  const received = { contexte: false, resultats: [] };
  const waiting = new Map();
  let next = 10;
  const publish = () => { document.body.dataset.sonde = JSON.stringify(received); };
  const post = message => window.parent.postMessage(message, '*');

  // Le routeur de GFS livre ici les messages du parent ; on ne lit que lui, et que les enveloppes (sans `mtype`).
  window.addEventListener('message', event => {
    const msg = event.data;
    if (event.source !== window.parent || !msg || msg.gfs !== 0 || msg.mtype !== undefined) return;
    if (msg.type === 'reponse' && msg.id === 1) {
      received.contexte = true;
      document.getElementById('state').textContent = 'Prête à ranger';
      publish();
    } else if (msg.type === 'reponse' || msg.type === 'erreur') {
      const done = waiting.get(msg.id);
      if (done) { waiting.delete(msg.id); done(msg); }
    } else if (msg.type === 'appel') {
      post({ gfs: 0, type: 'erreur', id: msg.id, code: 'GFS_INCONNU', message: 'L\'appel « ' + msg.nom + ' » est inconnu de cette app.' });
    }
  });

  // Les octets du labo (base64) deviennent un `File` de ce cadre : c'est lui que le cadre envoie à GFS par le message, comme l'app le fera avec le PDF qu'elle vient de fabriquer.
  const fileOf = (b64, name) => {
    const text = atob(b64);
    const bytes = new Uint8Array(text.length);
    for (let at = 0; at < text.length; at += 1) bytes[at] = text.charCodeAt(at);
    return new File([bytes], name, { type: 'application/pdf' });
  };

  // Un appel `ranger` : la demande `args` est envoyée telle quelle ; la promesse rend la réponse de GFS (et elle est écrite dans `resultats`).
  const call = (label, args) => new Promise(resolve => {
    const id = next++;
    waiting.set(id, msg => {
      const result = msg.type === 'reponse' ? { label, ok: true, data: msg.data } : { label, ok: false, code: msg.code, message: msg.message };
      received.resultats.push(result);
      publish();
      resolve(result);
    });
    post({ gfs: 0, type: 'appel', id, nom: 'ranger', args });
  });

  // item : { b64, nom, fichier? (le nom du File, par défaut « export.pdf »), lot?, suivants?, dossier?, type? } -> la demande de l'app. `brut` : une demande donnée telle quelle (une demande hors règle, pour la mesurer).
  const request = item => {
    if (item.brut) return item.brut;
    const args = { fichier: fileOf(item.b64, item.fichier || 'export.pdf'), nom: item.nom };
    for (const key of ['lot', 'suivants', 'dossier', 'type']) if (item[key] !== undefined) args[key] = item[key];
    return args;
  };

  window.sondeZ = {
    // Un fichier rangé.
    ranger: item => call(item.nom || 'brut', request(item)),
    // Un export en lot, comme le fera l'app : les fichiers l'un après l'autre, avec le nom du lot et combien en restent après celui-ci.
    exporter: async (lot, items, dossier) => {
      const results = [];
      for (let at = 0; at < items.length; at += 1) {
        const item = items[at];
        results.push(await call(item.nom, request({ ...item, lot, suivants: items.length - 1 - at, ...(dossier ? { dossier } : {}) })));
      }
      return results;
    },
    // Tous les appels d'un coup, sans attendre les réponses (une app qui ne se soucie pas de l'ordre).
    ensemble: items => Promise.all(items.map(item => call(item.nom, request(item)))),
  };
  // Ce que fait le script d'API de Grist au démarrage d'une app : `ready`, puis le thème (c'est alors que GFS montre le cadre).
  post({ mtype: 5 });
  post({ mtype: 4, data: { message: 'themeInitialized' } });
  post({ gfs: 0, type: 'appel', id: 1, nom: 'contexte', args: {} });
  publish();
}());
