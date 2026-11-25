// Les textes de l'annuaire dont le contraste se mesure (4,5:1), que partagent l'essai de chaque écran (test/annuaire-firefox.mjs) et celui des ambiances (test/annuaire-ambiances-firefox.mjs) :
// [le texte, le fond sur lequel il se pose].
export const PROBES = {
  title: ['.an-top h2', '.mod'], name: ['.an-name-t', '.an-name'], seg: ['.an-seg-b[aria-pressed="true"]', '.an-seg-b'], segOff: ['.an-seg-b[aria-pressed="false"]', '.an-seg'],
  personName: ['.an-person[aria-pressed="false"] .an-pe-name', '.an-card'], personSub: ['.an-person[aria-pressed="false"] .an-pe-sub', '.an-card'],
  pill: ['.an-person[aria-pressed="false"] .an-pill', '.an-card'], treeName: ['.an-tn[aria-selected="false"] .an-tn-name', '.an-card'], treeCount: ['.an-tn[aria-selected="false"] .an-pill', '.an-card'],
  treeOn: ['.an-tn[aria-selected="true"] .an-tn-name', '.an-tb'], rowOn: ['.an-person[aria-pressed="true"] .an-pe-name', '.an-person'], rowOnSub: ['.an-person[aria-pressed="true"] .an-pe-sub', '.an-person'],
  foot: ['.an-foot', '.mod'], crumb: ['.an-crumb', '.an-card'], cardName: ['.an-pcard[aria-pressed="false"] .an-pe-name', '.an-card'], cardLine: ['.an-pcard .an-pc-line', '.an-card'],
  ficheName: ['.an-fiche-id h3', '.an-card'], ficheSub: ['.an-fiche-id .an-pe-sub', '.an-card'], ficheLabel: ['.an-fr dt', '.an-card'], ficheValue: ['.an-fr dd', '.an-card'],
  ficheLink: ['.an-fiche-card .an-link', '.an-card'], fvRow: ['.an-fv[aria-checked="false"] .an-fv-t', '.menu-panel'], fvOn: ['.an-fv[aria-checked="true"] .an-fv-t', '.an-fv'], fvCount: ['.an-fv-n', '.menu-panel'],
  fsecHead: ['.an-fsec-h .an-fsec-t', '.menu-panel'], badge: ['.an-badge', '.an-badge'], reset: ['.an-reset', '.mod'], toolOn: ['.an-tbtn.is-on .an-tb-t', '.an-tbtn'],
  orgTitle: ['.an-oc[aria-pressed="false"] .an-oc-title', '.an-card'], orgSub: ['.an-oc[aria-pressed="false"] .an-oc-sub', '.an-card'], orgOn: ['.an-oc[aria-pressed="true"] .an-oc-title', '.an-oc'],
  zoom: ['.an-zoom', '.an-card'], note: ['.an-note', '.an-card'],
};
