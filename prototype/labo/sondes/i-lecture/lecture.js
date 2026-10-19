// Sonde I du labo (« Select by », le mode lecture de Publipostage+) : une app qui s'abonne à la ligne choisie et au lien de sa section comme Publipostage+ (js/grist-api.js, `init`) : deux
// `onRecord` (`shown` puis `normal`, qui exige l'accès complet ; `normal` fait foi dès qu'il a livré une ligne) et `onOptions`, avec le VRAI script d'API de Grist.
// Ce qu'elle a reçu est écrit dans `document.body.dataset.lecture`, que le labo lit : la dernière ligne (`ligne`), le dernier lien (`lien` : le `settings.linking` d'`onOptions`, `'absent'`
// quand Grist n'en dit rien), le niveau d'accès (`acces`) et le journal de tout ce qui est arrivé.
(function () {
  'use strict';
  const started = performance.now();
  const out = { ligne: null, lien: null, acces: null, journal: [] };
  const publish = () => { document.body.dataset.lecture = JSON.stringify(out); };
  const stamp = (nom, data) => { out.journal.push({ nom, ms: Math.round(performance.now() - started), ...data }); publish(); };

  grist.ready({ requiredAccess: 'full' });
  grist.onOptions((options, settings) => {
    out.lien = settings && settings.linking !== undefined ? settings.linking : 'absent';
    out.acces = settings && settings.accessLevel;
    stamp('onOptions', { lien: out.lien, acces: out.acces });
  });
  let normalDelivered = false;
  const onRow = via => record => {
    if (via === 'shown' && normalDelivered) return;
    if (via === 'normal') normalDelivered = true;
    out.ligne = record ? { id: record.id, Nom: record.Nom } : null;
    stamp('onRecord', { via, ligne: out.ligne });
  };
  grist.onRecord(onRow('shown'), { includeColumns: 'shown' });
  grist.onRecord(onRow('normal'), { includeColumns: 'normal' });
  publish();
}());
