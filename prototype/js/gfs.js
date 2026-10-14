// GFS : le widget qui héberge les apps (contrats 4.1). Ordre de démarrage : le routeur (déjà là), le script d'API de Grist (déjà là),
// puis ce module : abonnement aux événements de Grist, grist.ready(), lecture des manifestes, choix de l'app à ouvrir.

import { CATALOGUE, catalogueEntry } from './catalogue.js';
import { loadAll, label } from './manifest.js';
import { GristState } from './state.js';
import { createPort } from './broker.js';
import { AppSession } from './session.js';
import { readPreferences } from './frames.js';

const grist = window.grist;
const router = window.GFSRouter;
const $ = id => document.getElementById(id);

const params = new URLSearchParams(location.search);
const lang = (params.get('language') || navigator.language || 'fr').toLowerCase().startsWith('en') ? 'en' : 'fr';
const T = {
  fr: {
    title: 'Grist Factory Suite', idle: 'Choisis une app pour commencer.', open: 'Ouvrir', unavailable: 'Indisponible',
    loading: n => `${n} se charge…`, timeout: n => `${n} ne répond pas.`, ready: n => `${n} est prête.`, noGrist: 'GFS doit être ajouté comme widget personnalisé dans Grist.',
  },
  en: {
    title: 'Grist Factory Suite', idle: 'Pick an app to start.', open: 'Open', unavailable: 'Unavailable',
    loading: n => `${n} is loading…`, timeout: n => `${n} is not responding.`, ready: n => `${n} is ready.`, noGrist: 'GFS must be added to Grist as a custom widget.',
  },
}[lang];

const state = new GristState();
let apps = [];
let session = null;

const fetchJson = async path => {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${path} : ${response.status}`);
  return response.json();
};

function setStatus(text, bad) {
  const el = $('status');
  el.hidden = !text;
  el.textContent = text || '';
  el.classList.toggle('status--bad', Boolean(bad));
}

function onStatus(kind, current) {
  const name = label(current.manifest.nom, lang);
  document.body.dataset.appStatus = kind;
  if (kind === 'loading') setStatus(T.loading(name));
  else if (kind === 'timeout') setStatus(T.timeout(name), true);
  else setStatus('');
}

function sessionContext(app) {
  return {
    entry: app.app, manifest: app.manifest, catalogue: apps.filter(a => a.ok).map(a => a.manifest), state, port: createPort(grist), router,
    container: $('frames'), readonly: params.get('readonly') === 'true', preferences: readPreferences(location.search), base: document.baseURI, lang, onStatus,
  };
}

function activate(id) {
  const app = apps.find(a => a.app.id === id && a.ok);
  if (!app) return false;
  if (session) session.close();
  session = new AppSession(sessionContext(app));
  session.open();
  $('idle').hidden = true;
  return true;
}

// Provisoire (explorateur à venir) : la liste des apps du catalogue, pour ouvrir l'une d'elles.
function showIdle() {
  $('idle-title').textContent = T.title;
  $('idle-text').textContent = T.idle;
  const box = $('idle-apps');
  box.replaceChildren(...apps.map(app => {
    const button = document.createElement('button');
    button.className = 'btn';
    button.type = 'button';
    button.textContent = app.manifest ? label(app.manifest.nom, lang) : app.app.id;
    button.disabled = !app.ok;
    button.title = app.ok ? '' : `${T.unavailable} : ${app.errors.join(' ; ')}`;
    button.addEventListener('click', () => activate(app.app.id));
    return button;
  }));
  $('idle').hidden = false;
}

// La fonction « print » du script d'API de Grist imprime la page de GFS ; GFS la remplace par un relais vers l'app active (contrats 4.3).
function installPrint() {
  grist.rpc.unregisterFunc('print');
  grist.rpc.registerFunc('print', () => (session && session.isReady ? session.callApp('print', [], 10000) : window.print()));
}

async function start() {
  if (window.parent === window) { setStatus(T.noGrist, true); document.body.dataset.gfs = 'standalone'; return; }
  grist.on('message', message => state.feed(message));
  grist.ready({ requiredAccess: 'full', onEditOptions: () => {} });
  installPrint();
  apps = await loadAll(CATALOGUE, fetchJson);
  await state.whenOptions();
  const wanted = params.get('ouvrir');
  if (!(wanted && catalogueEntry(wanted) && activate(wanted))) showIdle();
  document.body.dataset.gfs = 'ready';
}

start().catch(error => { console.error('GFS : démarrage impossible', error); setStatus(String(error && error.message), true); });
