// La page d'essai du 5e bouton de la barre sous Firefox (test/barre-ouverts-firefox.mjs) : la vraie barre de index.html (ses cinq boutons), le vrai `Dock` (js/shell/dock.js) et le vrai `OpenedBar`
// (js/explorer/opened-bar.js) sur des fichiers d'essai ; le reste de GFS est absent. `window.__bar` : `fill(n)` ouvre les n premiers fichiers (le dernier est celui que l'app affiche), `clear()` vide la liste,
// `edge(nom)` choisit le bord de la barre, `access(bool)` allume l'accessibilité renforcée, `opens` garde les clés des fichiers que le menu a fait ouvrir, `explorer` compte les « Ouvrir un autre fichier… ».
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
const state = { opens: [], explorer: 0 };

const dock = new Dock({
  root: document.getElementById('floaters'), stage, onFiles: () => {}, onOpened: () => bar.show(), onApps: () => {}, onWork: () => {}, onNotKept: () => {},
});
const bar = new OpenedBar({
  opened, files: () => FILES, session: () => session, dock, t, appName: id => APPS[id], open: file => state.opens.push(file.key), showExplorer: () => { state.explorer += 1; },
  notice: text => { toast.textContent = text; toast.hidden = false; },
});
dock.relabel(t);
dock.setPresent(true);
bar.sync();

window.__bar = {
  get opens() { return state.opens; },
  get explorer() { return state.explorer; },
  fill(count) { for (const file of FILES.slice(0, count)) opened.add(file.key, session); },
  clear() { for (const key of opened.keys()) opened.remove(key); state.opens.length = 0; toast.hidden = true; },
  keys: () => opened.keys(),
  edge(name) { dock.placeRow().submenu.find(item => item.label === t(`dock.${name}`)).run(); },
  access(on) { if (on) document.documentElement.setAttribute('data-ambiance', 'renforcee'); else document.documentElement.removeAttribute('data-ambiance'); },
};
window.__ready = new Promise(resolve => {
  if (document.readyState === 'complete') resolve(true);
  else window.addEventListener('load', () => resolve(true), { once: true });
});
