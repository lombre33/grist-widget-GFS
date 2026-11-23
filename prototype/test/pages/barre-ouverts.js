// La page d'essai du 5e bouton de la barre sous Firefox (test/barre-ouverts-firefox.mjs) : la vraie barre de index.html (ses six boutons, le sixième caché), le vrai `Dock` (js/shell/dock.js) et le vrai `OpenedBar`
// (js/explorer/opened-bar.js) sur des fichiers d'essai ; le reste de GFS est absent. `window.__bar` : `fill(n)` ouvre les n premiers fichiers (le dernier est celui que l'app affiche), `clear()` vide la liste,
// `edge(nom)` choisit le bord de la barre, `access(bool)` allume l'accessibilité renforcée, `real(bool)` fait entrer les fichiers que le menu ouvre dans la liste des ouverts, `lt(shown, coupes)` montre et règle le bouton « LanguageTool » (`ltClicks` compte ses clics), `opens` garde les clés des fichiers que le menu a fait ouvrir, `explorer` compte les « Ouvrir un autre fichier… ».
import { Dock } from '/js/shell/dock.js';
import { OpenedBar } from '/js/explorer/opened-bar.js';
import { OpenedFiles } from '/js/explorer/opened-files.js';
import { createI18n } from '/js/i18n/i18n.js';

const language = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'fr';
const { t } = createI18n(language);
const APPS = { pp: 'Publipostage+', form: 'Form+' };
const LONG = 'Convocation à la session de formation du 14 novembre pour les équipes de la direction régionale';
const FILES = [
  { key: 'pp:1', app: 'pp', name: 'Convocation', icon: 'doc' }, { key: 'pp:2', app: 'pp', name: 'Émargement', icon: 'doc' }, { key: 'form:3', app: 'form', name: 'Inscription à la formation', icon: 'check' },
  { key: 'pp:4', app: 'pp', name: 'Grille de suivi', icon: 'grid' }, { key: 'pp:5', app: 'pp', name: 'Attestation', icon: 'doc' }, { key: 'pp:6', app: 'pp', name: 'Programme', icon: 'doc' },
  { key: 'pp:7', app: 'pp', name: 'Liste des présents', icon: 'grid' }, { key: 'pp:8', app: 'pp', name: LONG, icon: 'doc' },
];
const toast = document.getElementById('toast');
const stage = document.getElementById('stage');
const session = {};
const opened = new OpenedFiles();
const state = { opens: [], explorer: 0, lt: { shown: false, coupes: false }, ltClicks: 0, real: false };

const dock = new Dock({
  root: document.getElementById('floaters'), stage, onFiles: () => {}, onOpened: () => bar.show(), onApps: () => {}, onWork: () => {}, onNotKept: () => {},
  // Le bouton « LanguageTool » : le clic fait ce que fait le contrôleur (couper ou rallumer), sans le reste de GFS.
  onLt: () => { state.ltClicks += 1; state.lt = { ...state.lt, coupes: !state.lt.coupes }; dock.setLt(state.lt); },
});
const bar = new OpenedBar({
  opened, files: () => FILES, session: () => session, dock, t, appName: id => APPS[id], showExplorer: () => { state.explorer += 1; },
  // Ouvrir un fichier : la clé est gardée ; avec `real(true)` il entre aussi dans la liste des ouverts et devient celui que l'app affiche, comme le fait `Openings` (js/broker/openings.js).
  open: file => { state.opens.push(file.key); if (state.real) opened.add(file.key, session); return Promise.resolve(true); },
  container: () => stage, inertTargets: () => [document.getElementById('frames'), document.getElementById('floaters')],
  notice: text => { toast.textContent = text; toast.hidden = false; },
});
dock.relabel(t);
dock.setPresent(true);
bar.sync();

window.__bar = {
  get opens() { return state.opens; },
  get explorer() { return state.explorer; },
  get ltClicks() { return state.ltClicks; },
  // Le 6e bouton : dans la barre (`shown`) et coupé ou non (`coupes`), comme le contrôleur le dit au `Dock`.
  lt(shown, coupes) { state.lt = { shown, coupes }; dock.setLt(state.lt); },
  fill(count) { for (const file of FILES.slice(0, count)) opened.add(file.key, session); },
  clear() { for (const key of opened.keys()) opened.remove(key); state.opens.length = 0; state.real = false; toast.hidden = true; },
  real(on) { state.real = on; },
  keys: () => opened.keys(),
  edge(name) { dock.placeRow().submenu.find(item => item.label === t(`dock.${name}`)).run(); },
  access(on) { if (on) document.documentElement.setAttribute('data-ambiance', 'renforcee'); else document.documentElement.removeAttribute('data-ambiance'); },
};
window.__ready = new Promise(resolve => {
  if (document.readyState === 'complete') resolve(true);
  else window.addEventListener('load', () => resolve(true), { once: true });
});
