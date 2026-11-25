// La page d'essai de l'annuaire sous Firefox (test/annuaire-firefox.mjs, module Annuaire, demande du porteur du 25/11) : le vrai contrôle (js/annuaire/annuaire-control.js), la vraie
// fenêtre, la vraie lecture (js/annuaire/annuaire-store.js) et les vraies feuilles de style de index.html, sur un faux Grist en mémoire (test/fake-grist.mjs) qui tient le document fictif
// des essais (test/annuaire-fixtures.mjs) plus deux lignes qui poussent la mise en page : un nom, un poste, une adresse et une structure très longs (et le nom très long est l'assistant de quelqu'un). Aucun Grist : ce que l'essai
// mesure est la mise en page, la souris et le clavier ; ce que Grist envoie vraiment se mesure dans le labo (labo/run-annuaire.mjs). La langue vient de `?lang=fr|en`.
// L'essai part de zéro pour le bouton « Personnes » de l'organigramme (clé `gfs.annuaire.orgPeople` retirée du navigateur). `window.__annuaire` est le contrôle ; `window.__annuaireNotices` garde les phrases qu'il dit ; `window.__annuaireLanguage(lang)` change la langue fenêtre ouverte, comme le
// contrôleur de GFS ; `window.__annuaireCopied` garde le dernier texte copié (le presse-papiers lui-même se mesure dans le labo).
import { createI18n } from '/js/i18n/i18n.js';
import { installSprite } from '/js/ui/icons.js';
import { fakeGrist } from '/test/fake-grist.mjs';
import { AnnuaireStore } from '/js/annuaire/annuaire-store.js';
import { AnnuaireControl } from '/js/annuaire/annuaire-control.js';
import { documentFixture, configFixture } from '/test/annuaire-fixtures.mjs';

const LONG_UNIT = 'Direction des relations internationales et de la coopération universitaire';

// Le document fictif, avec une structure et une personne aux textes très longs.
function longDocument() {
  const document = documentFixture();
  const { Structures: structures, Personnes: people } = document;
  const unit = 8;
  for (const [key, value] of Object.entries({ id: unit, Nom: LONG_UNIT, Niveau: 'Direction', Pole: 6, Direction: unit })) structures[key].push(value);
  const person = {
    id: 7, Nom: 'Jean-Baptiste de la Rochefoucauld-Montmorency', Poste: 'Directeur adjoint chargé des relations internationales et de la coopération universitaire',
    Email: 'jean-baptiste.de-la-rochefoucauld-montmorency@universite-exemple.fr', Tel: '01 02 03 04 55', Structure: unit, Contrat: 'Contractuel',
    Competences: ['L', 'Droit international'], Teletravail: true, Responsable: 5, Chef: false, Arrivee: null, Service: '', Site: 'Siège',
    Assistant: 0, Referents: null, Suppleant: 0,
  };
  for (const [key, value] of Object.entries(person)) people[key].push(value);
  people.Assistant[3] = person.id; // la personne au nom très long est l'assistant de Louis Girard : une relation qui pousse la mise en page
  return document;
}

// Les tables du document au format du faux Grist (des lignes).
function tablesOf(document) {
  return Object.fromEntries(Object.entries(document).map(([name, data]) => {
    const names = Object.keys(data).filter(key => key !== 'id');
    return [name, { columns: ['id', ...names], rows: data.id.map((id, at) => Object.fromEntries([['id', id], ...names.map(key => [key, data[key][at]])])) }];
  }));
}

async function mount() {
  const language = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'fr';
  let i18n = createI18n(language);
  const locale = lang => (lang === 'en' ? 'en-GB' : 'fr-FR');
  installSprite(document);
  try { window.localStorage.removeItem('gfs.annuaire.orgPeople'); } catch (error) { /* sans stockage, l'essai part du réglage par défaut */ }
  const grist = fakeGrist(tablesOf(longDocument()));
  // Deux réglages pour les essais de « Modifier » : `window.__annuaireRefuse` (un texte : Grist refuse d'écrire la table des personnes, comme le ferait une règle d'accès)
  // et `window.__annuaireBlock` (un texte : le document ne s'écrit pas, ce que dit `writeBlock`).
  const applyUserActions = grist.port.doc.applyUserActions;
  grist.port.doc.applyUserActions = async list => {
    if (window.__annuaireRefuse && list.some(action => action[0] === 'UpdateRecord' && action[1] === 'Personnes')) throw new Error(window.__annuaireRefuse);
    return applyUserActions(list);
  };
  const seed = new AnnuaireStore({ port: grist.port, consent: async () => true });
  // L'annuaire principal met l'adresse et le télétravail (un oui/non) en colonnes de la liste (retour du porteur, 25/11) : toute la mesure de la liste les porte.
  const base = configFixture();
  await seed.create({ name: 'Annuaire principal', table: 'Personnes', config: { ...base, columns: ['email'],
    fields: base.fields.map(field => (field.col === 'Teletravail' ? { ...field, column: true } : field)) } });
  await seed.create({ name: 'Annuaire des directions', table: 'Personnes', config: { ...configFixture(), levels: configFixture().levels.slice(0, 2) } });
  window.__annuaireNotices = [];
  window.__annuaireCopied = null;
  let lang = language;
  const control = new AnnuaireControl({ port: grist.port, container: document.getElementById('stage'), t: (key, vars) => i18n.t(key, vars), locale: () => locale(lang),
    inertTargets: () => [], ask: async () => true, notice: text => window.__annuaireNotices.push(text), writeBlock: () => window.__annuaireBlock || null, fullAccess: () => true });
  window.__annuaire = control;
  window.__annuaireBatches = () => JSON.parse(JSON.stringify(grist.batches)); // les actions que le faux Grist a reçues, dans l'ordre
  window.__annuaireLanguage = next => { lang = next; i18n = createI18n(next); control.relocalize(); };
}

window.__ready = mount().then(() => true);
