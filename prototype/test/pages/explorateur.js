// La page d'essai de l'interface sous Firefox (test/interfaces-firefox.test.mjs) : le vrai explorateur (js/explorer.js), la vraie fenêtre « Thème » (js/theme-window.js) et la vraie fenêtre « Ce nom est
// déjà pris » (js/conflict-window.js), sur des fichiers que le vrai modèle (js/explorer-model.js) lit dans des tables de la forme de celles de Grist, avec les feuilles de style et la carte d'importation de
// index.html (le test les recopie de la page, dans l'ordre). Aucun Grist : ce que l'essai mesure est la mise en page et la souris. La langue vient de `?lang=fr|en` ; `window.__opened` garde le nom du
// dernier fichier que l'explorateur a ouvert ; `window.__askConflict({ app, repeat })` ouvre la fenêtre du nom pris et `window.__conflict` garde la réponse de la personne quand elle se ferme.
import { askConflict } from '/js/conflict-window.js';
import { Explorer } from '/js/explorer.js';
import { applyFiling, readFiles, readFiling } from '/js/explorer-model.js';
import { createI18n } from '/js/i18n.js';
import { installSprite } from '/js/icons.js';
import { ThemeSetting } from '/js/theme.js';
import { ThemeWindow } from '/js/theme-window.js';

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
  const explorer = new Explorer({
    container: stage, i18n, locale, now: () => new Date(), appName: () => 'Publipostage+', typeLabel: file => (file.typeInfo ? file.typeInfo.nom[language] || file.typeInfo.nom.fr : file.type),
    lockOf: file => (file.type === 'macro' ? { text: i18n.t('ex.lockedExtension', { name: 'Macro-modèles' }) } : null), newTypes: () => [], importTypes: () => [], canClose: () => true,
    notice: () => {}, language: () => ({ choice: language, grist: language }), onLanguage: () => {}, onTheme: () => theme.open(), onOpen: file => { window.__opened = file.name; }, onNew: () => {},
    onImport: () => {}, onClose: () => {}, onApps: () => {}, personal: () => true, filing: {}, kept: null, onDemo: null,
  });
  const themeWindow = new ThemeWindow({ container: stage, i18n, locale, setting: new ThemeSetting({ ambianceStore: memory(), colorStore: memory() }), mode, inertTargets: () => [explorer.root] });
  theme.open = () => themeWindow.open();
  // Le fichier gardé qui porte déjà le nom, tel que GFS le décrit (date et auteur) ; la copie prendrait « (1) ».
  const detail = `${i18n.t('ex.modifiedOn', { date: '12/10/2026' })} · ${i18n.t('ex.modifiedBy', { by: 'Service RH' })}`;
  window.__askConflict = ({ app, repeat }) => {
    window.__conflict = null;
    askConflict({ container: stage, inertTargets: () => [explorer.root], t: (key, params) => i18n.t(key, params), name: 'Facture Martin.pdf', detail, copy: 'Facture Martin (1).pdf', app, repeat })
      .then(answer => { window.__conflict = answer; });
  };
  explorer.setFiles(files);
  explorer.open();
}

window.__ready = mount().then(() => true);
