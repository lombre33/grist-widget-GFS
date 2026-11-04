// La page d'essai de l'interface sous Firefox (test/interfaces-firefox.test.mjs) : le vrai explorateur (js/explorer.js), la vraie fenêtre « Thème » (js/theme-window.js) et la vraie fenêtre « Ce nom est
// déjà pris » (js/conflict-window.js), sur des fichiers que le vrai modèle (js/explorer-model.js) lit dans des tables de la forme de celles de Grist, avec les feuilles de style et la carte d'importation de
// index.html (le test les recopie de la page, dans l'ordre). Aucun Grist : ce que l'essai mesure est la mise en page et la souris. La langue vient de `?lang=fr|en` ; `window.__opened` garde le nom du
// dernier fichier que l'explorateur a ouvert ; `window.__askConflict({ app, repeat })` ouvre la fenêtre du nom pris et `window.__conflict` garde la réponse de la personne quand elle se ferme.
// La corbeille et le clavier (test/corbeille-firefox.mjs) : le vrai `Trash` (js/trash.js) et la vraie fenêtre d'accord (js/ask-window.js) sur un gardien de doublure qui déplace les fichiers entre deux
// listes ; `window.__filing` note ce que l'explorateur demande au rangement (renommer, déplacer, épingler), `window.__notices` les phrases qu'il dit, `window.__explorer` est l'explorateur, et
// `window.__reset()` remet les fichiers, la vue et la recherche comme au départ.
import { ask } from '/js/ask-window.js';
import { askConflict } from '/js/conflict-window.js';
import { Explorer } from '/js/explorer.js';
import { applyFiling, readFiles, readFiling } from '/js/explorer-model.js';
import { createI18n } from '/js/i18n.js';
import { installSprite } from '/js/icons.js';
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
  const bin = new Trash({
    managers: [guardian], ask: opts => ask({ ...opts, container: stage, inertTargets: () => [explorer.root] }), t: i18n.t, notice: text => window.__notices.push(text), refresh: async () => explorer.setFiles(live, trashed),
  });
  const explorer = new Explorer({
    container: stage, i18n, locale, now: () => new Date(), appName: () => 'Publipostage+', typeLabel: file => (file.typeInfo ? file.typeInfo.nom[language] || file.typeInfo.nom.fr : file.type),
    lockOf: file => (file.type === 'macro' ? { text: i18n.t('ex.lockedExtension', { name: 'Macro-modèles' }) } : null), newTypes: () => [], importTypes: () => [], canClose: () => true,
    notice: text => window.__notices.push(text), language: () => ({ choice: language, grist: language }), onLanguage: () => {}, onTheme: () => theme.open(), onOpen: file => { window.__opened = file.name; }, onNew: () => {},
    onImport: () => {}, onClose: () => {}, onApps: () => {}, personal: () => true, kept: null, onDemo: null, trash: bin,
    filing: { togglePin: noted('pin', 'name'), rename: noted('rename', 'name'), moveFile: noted('move', 'name'), renameFolder: async path => { window.__filing.push(['renameFolder', path]); }, moveFolder: async path => { window.__filing.push(['moveFolder', path]); } },
  });
  window.__explorer = explorer;
  window.__reset = () => {
    live = [...files];
    for (const file of live) file.trashed = null;
    trashed = [];
    window.__filing.length = 0;
    window.__notices.length = 0;
    window.__opened = null;
    Object.assign(explorer.state, { view: 'folder', path: '', display: 'list', type: 'all', q: '', sel: null });
    explorer.root.querySelector('input[type="search"]').value = '';
    explorer.setFiles(live, trashed);
    explorer.open();
  };
  const themeWindow = new ThemeWindow({ container: stage, i18n, locale, setting: new ThemeSetting({ ambianceStore: memory(), colorStore: memory() }), mode, inertTargets: () => [explorer.root] });
  theme.open = () => themeWindow.open();
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
  explorer.setFiles(live, trashed);
  explorer.open();
}

window.__ready = mount().then(() => true);
