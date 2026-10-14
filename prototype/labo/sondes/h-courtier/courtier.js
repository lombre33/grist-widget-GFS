// Sonde H du labo (étape 2, contrats 9 points 1, 2, 5 et 6) : une app qui utilise le VRAI script d'API de Grist, comme les apps de la suite. Elle note ce que Grist lui
// rejoue au démarrage (dans `body.dataset.courtier`) et offre au labo `window.courtier` : écrire des tables, demander un jeton, lister, par le courtier de GFS.
(function () {
  'use strict';
  const started = performance.now();
  const out = { rejeu: [] };
  const publish = () => { document.body.dataset.courtier = JSON.stringify(out); };
  const stamp = (nom, data) => { out.rejeu.push({ nom, ms: Math.round(performance.now() - started), ...(data || {}) }); publish(); };

  // Ce que la vraie app demande à Grist au démarrage : l'accès complet, des colonnes à mapper, un menu d'options. GFS doit absorber `configure` : rien de cela ne
  // doit changer la configuration de la section (le panneau de droite garde celle de GFS).
  grist.ready({ requiredAccess: 'full', allowSelectBy: true, columns: [{ name: 'Etiquette', optional: true, title: 'Étiquette' }], onEditOptions: () => stamp('onEditOptions') });
  grist.onOptions((options, interaction) => stamp('onOptions', { cles: options ? Object.keys(options).sort() : null, acces: interaction && interaction.accessLevel }));
  grist.onRecords(records => stamp('onRecords', { lignes: records.length, colonnes: records.length ? Object.keys(records[0]).sort() : [] }));
  grist.onRecord(record => stamp('onRecord', { id: record ? record.id : null }));

  const outcome = async fn => {
    try { return { ok: true, resultat: await fn() }; } catch (error) { return { ok: false, code: error && error.code, message: String((error && error.message) || error).slice(0, 220) }; }
  };
  const act = actions => outcome(() => grist.docApi.applyUserActions(actions));
  window.courtier = {
    ajouterTable: name => act([['AddTable', name, [{ id: 'A', type: 'Text' }]]]),
    retirerTable: tableId => act([['RemoveTable', tableId]]),
    renommerTable: (ancien, nouveau) => act([['RenameTable', ancien, nouveau]]),
    tables: () => outcome(() => grist.docApi.listTables()),
    jeton: () => outcome(() => grist.docApi.getAccessToken({ readOnly: true })),
    lire: tableId => outcome(async () => Object.keys(await grist.docApi.fetchTable(tableId))),
  };
  publish();
}());
