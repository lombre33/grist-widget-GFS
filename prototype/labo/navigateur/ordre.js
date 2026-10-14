// L'ordre des écouteurs `message` d'une fenêtre dans le navigateur qui ouvre cette page (contrats 1.2 et 9, point 4). Une fenêtre neuve (celle d'un cadre), un message
// que lui écrit sa page, et la liste de ceux qui l'ont vu, dans l'ordre. Le routeur de GFS compte sur l'ordre d'enregistrement (premier script de la page) ; ce que les
// navigateurs font de la phase de capture sur la fenêtre elle-même, `window.onmessage` compris, est ce qu'on mesure ici. Script classique : la page de mesures du
// navigateur le charge, et le labo (run-ordre.mjs) l'injecte dans une page vide, si bien qu'il n'y a qu'une seule liste de cas.
(function () {
  'use strict';

  // Chaque cas : ce qu'on enregistre sur la fenêtre, dans cet ordre. `log` reçoit le nom de chaque écouteur qui s'exécute.
  const CASES = [
    { nom: 'onmessage, puis bulle', installe: (win, log) => { win.onmessage = () => log.push('onmessage'); win.addEventListener('message', () => log.push('bulle'), false); } },
    { nom: 'bulle, puis onmessage', installe: (win, log) => { win.addEventListener('message', () => log.push('bulle'), false); win.onmessage = () => log.push('onmessage'); } },
    { nom: 'onmessage, puis capture', installe: (win, log) => { win.onmessage = () => log.push('onmessage'); win.addEventListener('message', () => log.push('capture'), true); } },
    { nom: 'capture, puis onmessage', installe: (win, log) => { win.addEventListener('message', () => log.push('capture'), true); win.onmessage = () => log.push('onmessage'); } },
    { nom: 'capture qui arrête, puis onmessage (le routeur de GFS)', installe: (win, log) => {
      win.addEventListener('message', event => { log.push('capture'); event.stopImmediatePropagation(); }, true);
      win.onmessage = () => log.push('onmessage');
    } },
    { nom: 'onmessage, puis capture qui arrête (un routeur tardif)', installe: (win, log) => {
      win.onmessage = () => log.push('onmessage');
      win.addEventListener('message', event => { log.push('capture'); event.stopImmediatePropagation(); }, true);
    } },
  ];

  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

  async function play(testCase, doc) {
    const log = [];
    const frame = doc.createElement('iframe');
    doc.body.append(frame);
    const win = frame.contentWindow;
    testCase.installe(win, log);
    win.postMessage('essai', '*');
    await new Promise(resolve => setTimeout(resolve, 200));
    frame.remove();
    return log;
  }

  // { ordres: { nom: [écouteurs dans l'ordre] }, captureAvant, routeurPremierSuffit } : les deux faits dont GFS dépend.
  //   captureAvant           la phase de capture passe avant les autres écouteurs de la fenêtre, quel que soit l'ordre d'enregistrement ;
  //   routeurPremierSuffit   un écouteur de capture qui arrête le message, enregistré avant `onmessage`, l'empêche de s'exécuter (ce que GFS exige).
  async function playAll(doc = document) {
    const ordres = {};
    for (const testCase of CASES) ordres[testCase.nom] = await play(testCase, doc);
    return {
      ordres,
      captureAvant: same(ordres['onmessage, puis capture'], ['capture', 'onmessage']),
      routeurPremierSuffit: same(ordres['capture qui arrête, puis onmessage (le routeur de GFS)'], ['capture']),
    };
  }

  window.GFSOrdre = { CASES, play, playAll };
}());
