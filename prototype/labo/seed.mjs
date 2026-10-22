// Données d'essai pour l'explorateur : les tables de Publipostage+ telles que l'app les crée (js/templates.js, js/template-preferences.js),
// remplies par GFS lui-même (accès complet) dans le vrai Grist du labo. Des libellés neutres (services, pôles) : aucun prénom, aucune personne.

const DAY = 86400;

const MODELS_COLUMNS = [
  { id: 'Nom', type: 'Text' }, { id: 'Contenu', type: 'Text' }, { id: 'NomFichierPDF', type: 'Text' }, { id: 'DateModif', type: 'DateTime' },
  { id: 'TypeModele', type: 'Text' }, { id: 'ModifiePar', type: 'Text' }, { id: 'EstParDefaut', type: 'Bool' },
];
const PREFS_COLUMNS = [
  { id: 'Utilisateur', type: 'Text' }, { id: 'ModeleId', type: 'Int' }, { id: 'Epingle', type: 'Bool' }, { id: 'Dossier', type: 'Text' }, { id: 'Replie', type: 'Bool' },
];

const RH = 'Service RH <rh@exemple.org>';
const BUREAU = 'Pôle Bureautique <bureautique@exemple.org>';
const ACHATS = 'Service Achats <achats@exemple.org>';

// [nom, type, il y a (secondes), par, dossier, épinglé]
const FILES = (now) => [
  ['Feuille d’émargement', 'document', 3 * DAY, RH, 'Formation', true],
  ['Émargement (grille)', 'grille', 3 * DAY + 900, RH, 'Formation', false],
  ['Convocation de session', 'email', 10 * DAY, BUREAU, 'Formation', false],
  ['Dossier de formation', 'macro', 7 * DAY, RH, 'Formation', false],
  ['Notes de session', 'document', 2 * 3600, '', 'Formation', false],
  ['Ancien programme', 'document', 400 * DAY, BUREAU, 'Formation/Archives 2025', false],
  ['Bon de commande fournisseur', 'document', 6 * DAY, ACHATS, 'Stock', false],
  ['Étiquette produit A6', 'document', 14 * DAY, '', 'Stock', false],
  ['Fiche d’inventaire', 'document', 14 * DAY + 3600, '', 'Stock', false],
  ['Bon de mouvement de stock', 'document', 13 * DAY, ACHATS, 'Stock', false],
  ['Réapprovisionnement fournisseur', 'email', 4 * DAY, ACHATS, 'Stock', false],
  ['Valorisation du stock par catégorie', 'grille', 9 * DAY, '', 'Stock', false],
  ['Facture / devis multi-TVA', 'document', 5 * DAY, '', 'Facturation', true],
  ['Badge événement A6', 'document', 11 * DAY, '', 'Événementiel', false],
  ['Programme de la journée', 'document', 1 * DAY, BUREAU, 'Événementiel', false],
  ['Contrat de prestation', 'document', 1800, '', '', false],
  ['Quittance de loyer', 'document', 17 * DAY, '', '', false],
  ['Support de session', 'diaporama', 3600, '', '', false],
].map(([name, type, ago, by, folder, pinned]) => ({ name, type, ts: Math.floor(now / 1000) - ago, by, folder, pinned }));

// Crée les tables si elles manquent, puis les remplit. `heavy` : { rows, bytes } ajoute des modèles lourds (mesure du coût de la lecture, contrats 2.4).
export async function seedFiles(frame, { heavy = null } = {}) {
  return frame.evaluate(async ({ MODELS_COLUMNS, PREFS_COLUMNS, files, heavy }) => {
    const have = (await grist.docApi.listTables()).map(String);
    const actions = [];
    if (!have.includes('Publipostage_Modeles')) actions.push(['AddTable', 'Publipostage_Modeles', MODELS_COLUMNS]);
    if (!have.includes('Publipostage_PreferencesModeles')) actions.push(['AddTable', 'Publipostage_PreferencesModeles', PREFS_COLUMNS]);
    if (actions.length) await grist.docApi.applyUserActions(actions);
    const rows = files.map(f => ({ ...f }));
    const filler = heavy ? 'x'.repeat(heavy.bytes) : '';
    for (let i = 0; heavy && i < heavy.rows; i++) rows.push({ name: `Modèle lourd ${i + 1}`, type: 'document', ts: Math.floor(Date.now() / 1000) - i * 60, by: '', folder: '', pinned: false });
    const col = key => rows.map(r => r[key]);
    await grist.docApi.applyUserActions([
      ['BulkAddRecord', 'Publipostage_Modeles', rows.map(() => null), {
        Nom: col('name'), TypeModele: col('type'), DateModif: col('ts'), ModifiePar: col('by'), EstParDefaut: rows.map(() => false),
        Contenu: rows.map((r, i) => (i < files.length ? `<p>${r.name}</p>` : filler)), NomFichierPDF: rows.map(() => ''),
      }],
      ['AddRecord', 'Publipostage_Modeles', null, { Nom: 'Réglages du document', TypeModele: 'reglages', Contenu: '{}' }],
    ]);
    const prefs = rows.map((r, i) => ({ id: i + 1, folder: r.folder, pinned: r.pinned })).filter(p => p.folder || p.pinned);
    await grist.docApi.applyUserActions([
      ['BulkAddRecord', 'Publipostage_PreferencesModeles', prefs.map(() => null), {
        Utilisateur: prefs.map(() => ''), ModeleId: prefs.map(p => p.id), Epingle: prefs.map(p => p.pinned), Dossier: prefs.map(p => p.folder), Replie: prefs.map(() => false),
      }],
      // Une ligne d'état de dossier (ModeleId = 0) et une ligne d'une autre personne : l'explorateur ne doit en tenir aucun compte.
      ['AddRecord', 'Publipostage_PreferencesModeles', null, { Utilisateur: '', ModeleId: 0, Dossier: 'Formation', Replie: true }],
      ['AddRecord', 'Publipostage_PreferencesModeles', null, { Utilisateur: 'autre@exemple.org', ModeleId: 1, Epingle: true, Dossier: 'Prive' }],
    ]);
    return { models: rows.length, prefs: prefs.length };
  }, { MODELS_COLUMNS, PREFS_COLUMNS, files: FILES(Date.now()), heavy });
}

// Les formulaires de Form+ tels que la consigne 007 les demande : une ligne par formulaire dans `FormPlus_Formulaires` (colonnes que le manifeste de Form+ nomme), et la
// définition de chacun en JSON dans `Definition`, que GFS ne lit pas. Des libellés neutres : aucune personne.
const FORMS_COLUMNS = [
  { id: 'Nom', type: 'Text' }, { id: 'TypeFormulaire', type: 'Text' }, { id: 'DateModif', type: 'DateTime' }, { id: 'ModifiePar', type: 'Text' }, { id: 'Definition', type: 'Text' },
];

// [nom, il y a (secondes), par]
const FORMS = (now) => [
  ['Inscription à une formation', 2 * 3600, RH],
  ['Demande de matériel', 2 * DAY, BUREAU],
  ['Retour de session', 9 * DAY, ''],
].map(([name, ago, by]) => ({ name, ts: Math.floor(now / 1000) - ago, by }));

export async function seedForms(frame) {
  return frame.evaluate(async ({ FORMS_COLUMNS, forms }) => {
    const have = (await grist.docApi.listTables()).map(String);
    if (!have.includes('FormPlus_Formulaires')) await grist.docApi.applyUserActions([['AddTable', 'FormPlus_Formulaires', FORMS_COLUMNS]]);
    await grist.docApi.applyUserActions([['BulkAddRecord', 'FormPlus_Formulaires', forms.map(() => null), {
      Nom: forms.map(form => form.name), TypeFormulaire: forms.map(() => 'formulaire'), DateModif: forms.map(form => form.ts), ModifiePar: forms.map(form => form.by),
      Definition: forms.map(form => JSON.stringify({ formTitle: form.name, questions: [] })),
    }]]);
    return { forms: forms.length };
  }, { FORMS_COLUMNS, forms: FORMS(Date.now()) });
}

// Un formulaire que Form+ a enregistré pour la section de son widget, comme elle le fait (consigne 007 : sa ligne dans `FormPlus_Formulaires`, `IdSectionWidget` à elle) : une section
// de formulaire natif de `Clients` sur une nouvelle page, puis la ligne qui la gère, avec deux questions. À son démarrage, Form+ y retrouve sa définition et montre son concepteur.
// `title` et `questions` : un autre formulaire que celui par défaut (deux questions), pour en semer plusieurs.
export async function seedFormDesigner(frame, { title = 'Inscription à une formation', questions = null } = {}) {
  return frame.evaluate(async ({ FORMS_COLUMNS, title, questions }) => {
    const sections = await grist.docApi.fetchTable('_grist_Views_section');
    const widget = sections.id[sections.parentKey.indexOf('custom')];
    const tables = await grist.docApi.fetchTable('_grist_Tables');
    const clients = tables.id[tables.tableId.indexOf('Clients')];
    const made = (await grist.docApi.applyUserActions([['CreateViewSection', clients, 0, 'form', null, null]])).retValues[0];
    const have = (await grist.docApi.listTables()).map(String);
    if (!have.includes('FormPlus_Formulaires')) await grist.docApi.applyUserActions([['AddTable', 'FormPlus_Formulaires', [...FORMS_COLUMNS, { id: 'IdSectionWidget', type: 'Numeric' }]]]);
    else if (!('IdSectionWidget' in await grist.docApi.fetchTable('FormPlus_Formulaires'))) await grist.docApi.applyUserActions([['AddColumn', 'FormPlus_Formulaires', 'IdSectionWidget', { type: 'Numeric' }]]);
    const definition = {
      formLink: `http://127.0.0.1:8910/o/docs/forms/LABO/${made.sectionRef}`, vsId: made.sectionRef, sourceVsId: made.sectionRef, viewRef: made.viewRef,
      formTitle: title, formDescription: '',
      questions: questions || [
        { id: 'q1', kind: 'text', label: 'Ville de départ', writeTable: 'Clients', writeCol: 'Ville' },
        { id: 'q2', kind: 'choice', label: 'Client', sourceTable: 'Clients', sourceCol: 'Nom' },
      ],
    };
    await grist.docApi.applyUserActions([['AddRecord', 'FormPlus_Formulaires', null, {
      Nom: definition.formTitle, TypeFormulaire: 'formulaire', DateModif: Math.floor(Date.now() / 1000), ModifiePar: 'Form+', IdSectionWidget: widget, Definition: JSON.stringify(definition),
    }]]);
    return { widget, form: made.sectionRef, page: made.viewRef };
  }, { FORMS_COLUMNS, title, questions });
}
