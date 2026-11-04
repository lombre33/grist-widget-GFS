// La page d'essai de l'interface sous Firefox (test/interfaces-firefox.test.mjs) : le vrai explorateur (js/explorer.js), la vraie fenêtre « Thème » (js/theme-window.js) et la vraie fenêtre « Ce nom est
// déjà pris » (js/conflict-window.js), sur des fichiers que le vrai modèle (js/explorer-model.js) lit dans des tables de la forme de celles de Grist, avec les feuilles de style et la carte d'importation de
// index.html (le test les recopie de la page, dans l'ordre). Aucun Grist : ce que l'essai mesure est la mise en page et la souris. La langue vient de `?lang=fr|en` ; `window.__opened` garde le nom du
// dernier fichier que l'explorateur a ouvert ; `window.__askConflict({ app, repeat })` ouvre la fenêtre du nom pris et `window.__conflict` garde la réponse de la personne quand elle se ferme.
// La corbeille et le clavier (test/corbeille-firefox.mjs) : le vrai `Trash` (js/trash.js) et la vraie fenêtre d'accord (js/ask-window.js) sur un gardien de doublure qui déplace les fichiers entre deux
// listes ; `window.__filing` note ce que l'explorateur demande au rangement (renommer, déplacer, épingler), `window.__notices` les phrases qu'il dit, `window.__explorer` est l'explorateur, et
// `window.__reset()` remet les fichiers, la vue et la recherche comme au départ. La copie et le presse-papiers (test/copier-firefox.mjs) : le vrai `Copying` (js/copying.js) sur un gardien de doublure qui
// ajoute une copie à la liste (premier nom libre), et un rangement de doublure qui déplace vraiment les fichiers et les dossiers ; `window.__copies` note [identifiant, dossier] de chaque copie rangée.
// Les icônes des types (test/icones-firefox.mjs) : l'ambiance se pose comme dans GFS, par le vrai `ThemeSetting` et le vrai `ThemeHost` (`window.__ambiance(id)`, le mode vient de `data-grist-appearance`), et
// `window.__withPdf()` ajoute à la liste un PDF gardé par GFS, lu par le vrai modèle avec le vrai manifeste de GFS (la famille « pdf », rouge) ; `window.__reset()` le retire et rend l'ambiance d'origine.
import { ask } from '/js/ask-window.js';
import { askConflict } from '/js/conflict-window.js';
import { Explorer } from '/js/explorer.js';
import { applyFiling, folderMoves, inside, normalizePath, readFiles, readFiling } from '/js/explorer-model.js';
import { Copying } from '/js/copying.js';
import { FILES_MANIFEST } from '/js/gfs-files.js';
import { createI18n } from '/js/i18n.js';
import { installSprite } from '/js/icons.js';
import { leaveQuestion } from '/js/leave.js';
import { ThemeHost } from '/js/theme-apply.js';
import { ThemeSetting } from '/js/theme.js';
import { ThemeWindow } from '/js/theme-window.js';
import { Trash } from '/js/trash.js';

const DAY = 86400;
// Nom, type (une valeur du manifeste ; `macro` est grisé, son extension étant éteinte), ancienneté en jours, auteur, dossier. Assez de lignes pour remplir un panneau de 400 px.
const MODELS = [
  ['Attestation de formation de fin de session', 'document', 13, 'Grist Factory', ''], ['Convocation', 'document', 13, 'Grist Factory', ''], ['Émargement', 'document', 13, 'Grist Factory', ''],
  ['Main', 'presentation', 1, 'Service RH', ''], ['Présentation commerciale', 'presentation', 12, 'Service RH', ''], ['Présentation commerciale (2)', 'presentation', 0.1, 'Service RH', ''],
  ['source', 'presentation', 12, 'Service RH', ''], ['test1', 'document', 0.3, 'Service RH', ''], ['Grille de suivi', 'grille', 20, 'Équipe formation', ''],
  ['Contrat de prestation', 'document', 5, 'Équipe formation', 'Formation'], ['Support de session', 'presentation', 6, 'Équipe formation', 'Formation'], ['Autre format', 'macro', 7, 'Service RH', ''],
];

// Les tables de Grist, en colonnes : les modèles, puis leur rangement (le dossier de chacun).
function tables(now) {
  const models = { id: [], Nom: [], TypeModele: [], DateModif: [], ModifiePar: [] };
  const prefs = { id: [], Utilisateur: [], ModeleId: [], Dossier: [], Epingle: [] };
  MODELS.forEach(([name, type, days, by, folder], index) => {
    models.id.push(index + 1);
    models.Nom.push(name);
    models.TypeModele.push(type);
    models.DateModif.push(now - Math.round(days * DAY));
    models.ModifiePar.push(by);
    prefs.id.push(index + 1);
    prefs.Utilisateur.push('');
    prefs.ModeleId.push(index + 1);
    prefs.Dossier.push(folder);
    prefs.Epingle.push(false);
  });
  return { models, prefs };
}

const memory = () => { const store = { value: null, read: () => store.value, write: value => { store.value = value; return true; } }; return store; };

async function mount() {
  const language = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'fr';
  const i18n = createI18n(language);
  const manifest = await (await fetch('/manifestes/publipostage.json')).json();
  const spec = manifest.fichiers[0];
  const { models, prefs } = tables(Math.floor(Date.now() / 1000));
  const files = applyFiling(readFiles(manifest, spec, models), readFiling(spec.rangement, prefs, ''));
  const stage = document.getElementById('stage');
  installSprite(document);
  const mode = () => (document.documentElement.getAttribute('data-grist-appearance') === 'dark' ? 'sombre' : 'clair');
  const locale = language === 'en' ? 'en-GB' : 'fr-FR';
  const theme = { open: () => {} };
  // Les fichiers vivants et ceux de la corbeille ; le gardien de doublure les déplace de l'une à l'autre, comme le ferait la table de GFS.
  let live = [...files];
  let trashed = [];
  const folders = new Map(files.map(file => [file.key, file.folder])); // où chaque fichier est au départ : couper puis coller en déplace, `__reset` les remet
  const pick = (list, wanted) => list.findIndex(file => file.key === wanted.key);
  const move = (from, to, wanted) => { const at = pick(from, wanted); if (at < 0) return null; const [file] = from.splice(at, 1); to.push(file); return file; };
  window.__filing = [];
  window.__notices = [];
  const noted = (name, ...args) => async file => { window.__filing.push([name, ...args.map(arg => (arg === 'name' ? file.name : file))]); };
  const guardian = {
    manages: () => true,
    lock: () => null,
    trash: async file => Boolean(move(live, trashed, file) && Object.assign(file, { trashed: { ts: Math.floor(Date.now() / 1000), by: 'Service RH' } })),
    restore: async file => { const back = move(trashed, live, file); if (back) back.trashed = null; return back ? { name: back.name, renamed: false } : null; },
    empty: async list => list.filter(file => move(trashed, [], file)).length,
  };
  // La copie : un gardien de doublure ajoute à la liste un fichier de plus, sous le premier nom libre « Nom (1) » ; un fichier de type « macro » ne se copie pas (grisé, comme une app sans recette).
  window.__copies = [];
  let copied = 100;
  const copier = {
    copies: file => file.type !== 'macro',
    lock: () => null,
    copy: async file => {
      const original = live.find(item => item.key === file.key);
      if (!original) return null;
      const id = String(++copied);
      const names = live.map(item => item.name);
      let n = 1;
      while (names.includes(`${original.name} (${n})`)) n += 1;
      const made = { ...original, key: `${original.app}:${id}`, id, row: copied, name: `${original.name} (${n})`, folder: '', pinned: false, search: '' };
      live.push(made);
      return { id, name: made.name };
    },
  };
  const copying = new Copying({
    managers: [copier], t: i18n.t, notice: text => window.__notices.push(text), refresh: async () => explorer.setFiles(live, trashed),
    file: async (app, id, folder) => { live.find(item => item.id === id).folder = folder; window.__copies.push([id, folder]); },
  });
  // Le rangement de doublure d'un fichier ou d'un dossier collé après Ctrl+X : il déplace vraiment, et rend ce que rend js/filing.js.
  const settle = result => { explorer.setFiles(live, trashed); return result; };
  const moving = {
    moveFileTo: async (file, folder) => {
      const at = live.find(item => item.key === file.key);
      if (!at) return undefined;
      window.__filing.push(['moveTo', at.name, folder]);
      if (at.folder === folder) return 'same';
      at.folder = folder;
      return settle('moved');
    },
    moveFolderTo: async (path, folder) => {
      const target = normalizePath(`${folder}/${path.split('/').pop()}`);
      window.__filing.push(['moveFolderTo', path, folder]);
      if (target === path) return 'same';
      if (inside(target, path)) return 'inside';
      const moves = folderMoves(live, path, target);
      if (!moves.length) return 'gone';
      for (const move of moves) live.find(item => item.id === move.file).folder = move.folder;
      return settle('moved');
    },
  };
  const bin = new Trash({
    managers: [guardian], ask: opts => ask({ ...opts, container: stage, inertTargets: () => [explorer.root] }), t: i18n.t, notice: text => window.__notices.push(text), refresh: async () => explorer.setFiles(live, trashed),
  });
  const explorer = new Explorer({
    container: stage, i18n, locale, now: () => new Date(), appName: () => 'Publipostage+', typeLabel: file => (file.typeInfo ? file.typeInfo.nom[language] || file.typeInfo.nom.fr : file.type),
    lockOf: file => (file.type === 'macro' ? { text: i18n.t('ex.lockedExtension', { name: 'Macro-modèles' }) } : null), newTypes: () => [], importTypes: () => [], canClose: () => true,
    notice: text => window.__notices.push(text), language: () => ({ choice: language, grist: language }), onLanguage: () => {}, onTheme: () => theme.open(), onOpen: file => { window.__opened = file.name; }, onNew: () => {},
    onImport: () => {}, onClose: () => {}, onApps: () => {}, personal: () => true, kept: null, trash: bin, copying,
    filing: { togglePin: noted('pin', 'name'), rename: noted('rename', 'name'), moveFile: noted('move', 'name'), renameFolder: async path => { window.__filing.push(['renameFolder', path]); }, moveFolder: async path => { window.__filing.push(['moveFolder', path]); }, ...moving },
  });
  window.__explorer = explorer;
  window.__reset = () => {
    explorer.close(); // la fermeture vide le presse-papiers : chaque mesure part de rien
    live = [...files];
    for (const file of live) { file.trashed = null; file.folder = folders.get(file.key); }
    trashed = [];
    window.__filing.length = 0;
    window.__copies.length = 0;
    window.__notices.length = 0;
    window.__opened = null;
    setting.reset(); // l'ambiance d'origine, comme au départ
    Object.assign(explorer.state, { view: 'folder', path: '', display: 'list', type: 'all', q: '', sel: null });
    explorer.root.querySelector('input[type="search"]').value = '';
    explorer.setFiles(live, trashed);
    explorer.open();
  };
  // Le thème comme dans GFS : un seul réglage, que la fenêtre « Thème » écrit et que l'hôte pose sur la page (l'ambiance et le mode de Grist, `data-grist-appearance`).
  const setting = new ThemeSetting({ ambianceStore: memory(), colorStore: memory() });
  new ThemeHost({ setting }).start();
  window.__ambiance = id => setting.choose(id);
  const themeWindow = new ThemeWindow({ container: stage, i18n, locale, setting, mode, inertTargets: () => [explorer.root] });
  theme.open = () => themeWindow.open();
  // Un PDF gardé par GFS, lu comme l'explorateur le lit : les colonnes de `GFS_Fichiers` et le manifeste de GFS. `__reset` remet `live` aux fichiers de départ : le PDF disparaît.
  window.__withPdf = () => {
    const [pdf] = readFiles(FILES_MANIFEST, FILES_MANIFEST.fichiers[0], { id: [900], Identifiant: ['essai-pdf'], Nom: ['Attestation.pdf'], Type: ['pdf'], Date: [Math.floor(Date.now() / 1000) - 3600], Auteur: ['Service RH'] });
    live.push(pdf);
    explorer.setFiles(live, trashed);
  };
  // Le fichier gardé qui porte déjà le nom, tel que GFS le décrit (date et auteur) ; la copie prendrait « (1) ».
  const detail = `${i18n.t('ex.modifiedOn', { date: '12/10/2026' })} · ${i18n.t('ex.modifiedBy', { by: 'Service RH' })}`;
  window.__askConflict = ({ app, repeat }) => {
    window.__conflict = null;
    askConflict({ container: stage, inertTargets: () => [explorer.root], t: (key, params) => i18n.t(key, params), name: 'Facture Martin.pdf', detail, copy: 'Facture Martin (1).pdf', app, repeat })
      .then(answer => { window.__conflict = answer; });
  };
  // La question de la table de la corbeille des fichiers des apps (contrats 6.7) : la fenêtre du widget, avec ses vrais textes, que le vrai contrôleur pose au premier fichier d'app mis à la corbeille.
  window.__askTable = () => void ask({
    title: i18n.t('trash.table.title'), message: i18n.t('trash.table.text'), confirmLabel: i18n.t('table.create'), cancelLabel: i18n.t('table.cancel'), container: stage, inertTargets: () => [explorer.root],
  });
  // La question de « fermer » (contrats 5.4, point 3) quand l'app se tait ou répond par une erreur : la fenêtre d'accord et les vrais textes de js/leave.js, avec le plus long nom d'app ; `window.__leave` garde
  // la réponse de la personne (`force` : « Fermer quand même », `stay` : « Attendre » ou « Rester »).
  window.__askLeave = reason => {
    window.__leave = null;
    ask({ ...leaveQuestion({ t: i18n.t, app: 'Publipostage+', fault: reason === null ? null : new Error(reason) }), container: stage, inertTargets: () => [explorer.root] })
      .then(answer => { window.__leave = answer ? 'force' : 'stay'; });
  };
  explorer.setFiles(live, trashed);
  explorer.open();
}

window.__ready = mount().then(() => true);
