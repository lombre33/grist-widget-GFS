// Sonde G du labo (étape 2, cahier 9 points 3, 5 et 8) : ce qu'une app peut faire dans le sous-cadre isolé de GFS. Une app minimale, SANS le script d'API de Grist.
// Chaque essai part d'un clic (la vraie souris du labo : l'activation de la page que demandent les téléchargements, les fenêtres et le presse-papiers) ; son résultat
// est écrit dans `document.body.dataset.cap`, que le labo lit. Ce que la page ne voit pas d'elle-même (le téléchargement arrivé, la fenêtre ouverte, le message du
// navigateur) est relevé par le labo. Les essais disent « ok » ou l'erreur du navigateur, jamais une interprétation.
(function () {
  'use strict';
  const results = {};
  // `?hote` : la page de mesures du navigateur (labo/navigateur/) héberge la sonde et veut ses résultats ; sous GFS, rien n'est envoyé.
  const toHost = new URLSearchParams(location.search).has('hote');
  const publish = () => {
    document.body.dataset.cap = JSON.stringify(results);
    if (toHost) window.parent.postMessage({ sondeG: results }, '*');
  };
  // Pour une personne, la page garde les essais qu'elle peut juger à l'œil et qui ne détruisent pas le cadre ; les autres restent au labo.
  if (toHost) {
    for (const name of ['cadreImpression', 'fenetreNoopener', 'plein', 'chercher', 'mailtoMeme', 'naviguerMeme', 'naviguerAutre', 'naviguerHaut', 'naviguerParent']) {
      document.querySelector(`[data-test="${name}"]`).remove();
    }
  }
  const describe = error => `${(error && error.name) || 'Error'} : ${String((error && error.message) || error).slice(0, 110)}`;
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const page = name => new URL(name, location.href).href;

  async function attempt(fn) {
    try { return { ok: true, value: await fn() }; } catch (error) { return { ok: false, erreur: describe(error) }; }
  }
  const verdict = async fn => { const result = await attempt(fn); return result.ok ? 'ok' : result.erreur; };

  // ----- Stockage et politique des fonctionnalités (cahier 9, point 5)
  const FEATURES = ['clipboard-write', 'clipboard-read', 'fullscreen', 'camera', 'microphone', 'geolocation', 'display-capture', 'web-share', 'autoplay', 'payment'];
  const policy = () => document.permissionsPolicy || document.featurePolicy;

  async function stockage() {
    const out = { origine: window.origin, contexteSecurise: window.isSecureContext, fonctionnalitesPermises: policy() ? FEATURES.filter(f => policy().allowsFeature(f)) : null };
    const probes = {
      localStorage: () => window.localStorage.setItem('essai', '1'),
      sessionStorage: () => window.sessionStorage.setItem('essai', '1'),
      cookie: () => { document.cookie = 'essai=1'; return document.cookie.includes('essai=1'); },
      indexedDB: () => new Promise((resolve, reject) => { const request = window.indexedDB.open('essai'); request.onsuccess = () => resolve('ouvert'); request.onerror = () => reject(request.error); }),
      caches: () => window.caches.open('essai'),
      stockageDuNavigateur: () => navigator.storage.estimate(),
    };
    for (const [name, fn] of Object.entries(probes)) out[name] = await verdict(fn);
    return out;
  }

  // ----- Impression (cahier 9, point 3). Le cadre d'impression de Publipostage+ (js/print-export.js) : un cadre caché `sandbox="allow-same-origin allow-modals"`
  // dont `srcdoc` porte la mise en page ; l'app lit ensuite son document, ses styles calculés, écoute `afterprint` puis appelle `print()` sur sa fenêtre.
  // Quatre façons de faire le cadre : la sienne (A), sans attribut `sandbox` (B), vide puis écrit par `document.write` (C), avec `allow-modals` seul (D).
  const PRINT_FRAMES = {
    A: { sandbox: 'allow-same-origin allow-modals', srcdoc: true },
    B: { sandbox: null, srcdoc: true },
    C: { sandbox: null, srcdoc: false },
    D: { sandbox: 'allow-modals', srcdoc: true },
  };
  async function printFrame({ sandbox, srcdoc }) {
    const out = {};
    const frame = document.createElement('iframe');
    if (sandbox) frame.setAttribute('sandbox', sandbox);
    frame.style.cssText = 'position:fixed;left:-20000px;top:0;width:300px;height:200px;border:0';
    const html = '<!doctype html><title>Essai</title><body><p id="x">essai</p></body>';
    if (srcdoc) frame.srcdoc = html;
    const loaded = new Promise(resolve => frame.addEventListener('load', () => resolve('chargé'), { once: true }));
    document.body.append(frame);
    if (!srcdoc) await attempt(() => { frame.contentDocument.open(); frame.contentDocument.write(html); frame.contentDocument.close(); });
    out.chargement = srcdoc ? await Promise.race([loaded, pause(3000).then(() => 'jamais chargé')]) : 'écrit';
    const win = frame.contentWindow;
    out.contentDocument = (await attempt(() => (frame.contentDocument ? 'accessible' : 'null'))).value || 'erreur';
    out.document = await verdict(() => win.document.title);
    out.getComputedStyle = await verdict(() => win.getComputedStyle(win.document.body));
    out.afterprint = await verdict(() => win.addEventListener('afterprint', () => {}, { once: true }));
    out.print = await verdict(() => win.print());
    frame.remove();
    return out;
  }
  async function cadreImpression() {
    const out = {};
    for (const [key, variant] of Object.entries(PRINT_FRAMES)) out[key] = await printFrame(variant);
    return out;
  }

  // L'impression sans cadre : la page s'imprime elle-même (`window.print()`), ce que fait aussi le `print` du script d'API de Grist.
  async function impressionDirecte() {
    const events = [];
    const log = event => events.push(event.type);
    window.addEventListener('beforeprint', log);
    window.addEventListener('afterprint', log);
    const call = await verdict(() => window.print());
    await pause(600);
    window.removeEventListener('beforeprint', log);
    window.removeEventListener('afterprint', log);
    return { appel: call, evenements: events };
  }

  // ----- Téléchargements : `<a download>` sur un Blob, comme js/export-common.js.
  function download(href, name) {
    const link = document.createElement('a');
    link.href = href;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
  }
  async function telechargementBlob() {
    const url = URL.createObjectURL(new Blob(['essai de téléchargement'], { type: 'text/plain' }));
    download(url, 'essai-blob.txt');
    return { adresse: url.slice(0, 18) };
  }
  async function telechargementData() {
    download(`data:text/plain;base64,${btoa('essai de téléchargement')}`, 'essai-data.txt');
    return { adresse: 'data:' };
  }

  // ----- Fenêtres : une seule par geste (le navigateur refuse la seconde), d'où deux boutons.
  async function ouvrir(features) {
    const opened = window.open(page('popup.html?fenetre'), '_blank', features);
    const out = { retour: opened ? 'fenêtre rendue' : 'null' };
    if (opened) out.accesALaFenetre = await verdict(() => opened.document.title);
    return out;
  }
  const fenetre = () => ouvrir(undefined);
  const fenetreNoopener = () => ouvrir('noopener,noreferrer');

  // ----- Presse-papiers (js/first-contact.js : navigator.clipboard.writeText) et plein écran.
  async function presse() {
    const out = { ecrire: await verdict(() => navigator.clipboard.writeText('essai de GFS')) };
    out.lire = await verdict(() => navigator.clipboard.readText());
    out.execCommand = await verdict(() => {
      const area = document.createElement('textarea');
      area.value = 'essai';
      document.body.append(area);
      area.select();
      const done = document.execCommand('copy');
      area.remove();
      if (!done) throw new Error('execCommand a rendu false');
      return done;
    });
    return out;
  }
  async function plein() {
    const out = { permis: document.fullscreenEnabled };
    out.demande = await verdict(() => document.documentElement.requestFullscreen());
    if (document.fullscreenElement) await document.exitFullscreen();
    return out;
  }

  // ----- Lire une adresse : la sienne (CORS depuis une origine opaque), puis un autre site (même machine, autre nom d'hôte).
  async function chercher() {
    const own = page('popup.js');
    const other = new URL(own);
    other.hostname = 'localhost';
    return { memeSite: await verdict(async () => (await fetch(own)).status), autreSite: await verdict(async () => (await fetch(other.href)).status) };
  }

  // ----- Navigation du cadre (cahier 9, point 8) : l'essai peut détruire la page, le résultat est écrit avant.
  function navigate(url) {
    results.navigation = { demandee: url };
    publish();
    window.location.href = url;
  }
  async function naviguerMeme() { navigate(page('ailleurs.html')); return results.navigation; }
  async function naviguerAutre() {
    const other = new URL(page('ailleurs.html'));
    other.hostname = 'localhost';
    navigate(other.href);
    return results.navigation;
  }
  async function naviguerHaut() { return { top: await verdict(() => { window.top.location.href = page('ailleurs.html'); }) }; }
  async function naviguerParent() { return { parent: await verdict(() => { window.parent.location.href = page('ailleurs.html'); }) }; }

  const TESTS = { stockage, cadreImpression, impressionDirecte, telechargementBlob, telechargementData, fenetre, fenetreNoopener, presse, plein, chercher,
    naviguerMeme, naviguerAutre, naviguerHaut, naviguerParent };

  document.addEventListener('click', async event => {
    const target = event.target.closest('button[data-test]');
    if (!target || !TESTS[target.dataset.test]) return;
    const name = target.dataset.test;
    results[name] = await attempt(TESTS[name]).then(r => (r.ok ? r.value : { erreur: r.erreur }));
    publish();
  });
  publish();
  // Ce que fait le script d'API de Grist au démarrage d'une app : `ready`, puis le thème (GFS montre alors le cadre).
  window.parent.postMessage({ mtype: 5 }, '*');
  window.parent.postMessage({ mtype: 4, data: { message: 'themeInitialized' } }, '*');
}());
