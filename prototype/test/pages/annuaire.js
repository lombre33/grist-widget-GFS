// La page d'essai de l'annuaire sous Firefox (test/annuaire-firefox.mjs, module Annuaire, demande du porteur du 25/11) : le vrai contrôle (js/annuaire/annuaire-control.js), la vraie
// fenêtre, la vraie lecture (js/annuaire/annuaire-store.js) et les vraies feuilles de style de index.html, sur un faux Grist en mémoire (test/fake-grist.mjs) qui tient le document fictif
// des essais (test/annuaire-fixtures.mjs) plus deux lignes qui poussent la mise en page : un nom, un poste, une adresse et une structure très longs (et le nom très long est l'assistant de quelqu'un). Aucun Grist : ce que l'essai
// mesure est la mise en page, la souris et le clavier ; ce que Grist envoie vraiment se mesure dans le labo (labo/run-annuaire.mjs). La langue vient de `?lang=fr|en`.
// `?tools=1` : le document des essais de « À vérifier », « Écrire au groupe » et « Ma présence » (test/annuaire-tools-firefox.mjs) : deux colonnes de plus (une date de
// départ, un oui/non « apparaître »), un doublon de nom, une personne sans rattachement, un responsable qui n'existe pas, un départ dépassé, une personne masquée et
// cinquante agents aux adresses longues (de quoi dépasser le lien d'un message) ; `&admin=0` : la personne qui lit n'administre pas le document ; `&me=adresse` : son adresse.
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

// Le document des essais de `?tools=1` : celui de `longDocument`, plus de quoi faire parler les contrôles.
function toolsDocument() {
  const document = longDocument();
  const { Personnes: people, _grist_Tables_column: columns } = document;
  people.Depart = people.id.map(() => null);
  people.Visible = people.id.map(() => null);
  columns.id.push(37, 38);
  columns.parentId.push(1, 1);
  columns.colId.push('Depart', 'Visible');
  columns.type.push('Date', 'Bool');
  columns.visibleCol.push(0, 0);
  columns.widgetOptions.push('', '');
  columns.isFormula.push(false, false);
  const blank = { Nom: '', Poste: '', Email: '', Tel: '', Structure: 0, Contrat: '', Competences: null, Teletravail: null, Responsable: 0, Chef: false, Arrivee: null, Service: '',
    Site: '', Assistant: 0, Referents: null, Suppleant: 0, Depart: null, Visible: null };
  const add = row => {
    const values = { ...blank, ...row, id: people.id.length + 1 };
    for (const key of Object.keys(people)) people[key].push(values[key] ?? null);
  };
  add({ Nom: 'Léa Garnier', Poste: 'Chargée de mission', Email: 'lea.garnier@exemple.fr', Structure: 3, Site: 'Siège' });
  add({ Nom: 'Lea Garnier', Poste: 'Chargée de mission', Email: 'l.garnier@exemple.fr', Structure: 7, Site: 'Campus Sud' });
  add({ Nom: 'Noé Petit', Poste: 'Technicien', Email: 'noe.petit@exemple.fr', Structure: 0 });
  add({ Nom: 'Julien Mercier', Poste: 'Chargé de communication', Email: 'julien.mercier@exemple.fr', Structure: 3, Responsable: 99 });
  add({ Nom: 'Rémi Colas', Poste: 'Gestionnaire', Email: 'remi.colas@exemple.fr', Structure: 3, Depart: Date.UTC(2026, 8, 30) / 1000 });
  add({ Nom: 'Sacha Bernard', Poste: 'Archiviste', Email: 'sacha.bernard@exemple.fr', Structure: 7, Visible: false });
  for (let n = 1; n <= 50; n++) add({ Nom: `Agent Essai ${String(n).padStart(2, '0')}`, Poste: 'Agent', Structure: 5, Email: `agent.essai.${String(n).padStart(2, '0')}@universite-exemple.fr` });
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
  const query = new URLSearchParams(location.search);
  const tools = query.get('tools') === '1';
  const grist = fakeGrist(tablesOf(tools ? toolsDocument() : longDocument()));
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
  const options = tools ? { checks: ['dup', 'mail', 'att', 'resp', 'dep'], leave: 'Depart', presence: { on: true, col: 'Visible' }, mail: { per: 40, to: 'bcc' } } : {};
  await seed.create({ name: 'Annuaire principal', table: 'Personnes', config: { ...base, ...options, columns: ['email'],
    fields: base.fields.map(field => (field.col === 'Teletravail' ? { ...field, column: true } : field)) } });
  await seed.create({ name: 'Annuaire des directions', table: 'Personnes', config: { ...configFixture(), levels: configFixture().levels.slice(0, 2) } });
  window.__annuaireNotices = [];
  window.__annuaireCopied = null;
  let lang = language;
  const control = new AnnuaireControl({ port: grist.port, container: document.getElementById('stage'), t: (key, vars) => i18n.t(key, vars), locale: () => locale(lang),
    inertTargets: () => [], ask: async () => true, notice: text => window.__annuaireNotices.push(text), writeBlock: () => window.__annuaireBlock || null, fullAccess: () => true,
    isOwner: async () => query.get('admin') !== '0', identity: () => query.get('me') || '' });
  window.__annuaire = control;
  window.__annuaireBatches = () => JSON.parse(JSON.stringify(grist.batches)); // les actions que le faux Grist a reçues, dans l'ordre
  window.__annuaireLanguage = next => { lang = next; i18n = createI18n(next); control.relocalize(); };
}

window.__ready = mount().then(() => true);
