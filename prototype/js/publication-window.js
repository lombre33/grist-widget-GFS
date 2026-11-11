// La question de l'accord à la publication (contrats 3.3, point 9) : ce que le lien du formulaire ouvrira, en mots simples, dans la fenêtre commune des questions
// (js/ask-window.js). Le clavier commence sur « Refuser ». Les noms de tables et de colonnes viennent du document : ils entrent dans la fenêtre comme du texte.

const LISTED_COLUMNS = 6;

function columnsText(t, columns) {
  const listed = columns.slice(0, LISTED_COLUMNS).join(', ');
  return columns.length > LISTED_COLUMNS ? listed + t('pub.more', { n: columns.length - LISTED_COLUMNS }) : listed;
}

// opts : { t, app, opens } avec opens = { tables: [{ tableId, shown, unshown }], reads: [{ tableId, colId }] } (js/publication.js). Rend les réglages de `ask`.
export function publicationQuestion({ t, app, opens }) {
  const writes = opens.tables.map(table => (table.unshown.length
    ? t('pub.writeHidden', { table: table.tableId, n: table.unshown.length, columns: columnsText(t, table.unshown) })
    : t('pub.write', { table: table.tableId })));
  const reads = opens.reads.map(read => t('pub.read', { table: read.tableId, column: read.colId }));
  return { title: t('pub.title'), message: t('pub.text', { app }), items: [...writes, ...reads], note: t('pub.note'), confirmLabel: t('pub.allow'), cancelLabel: t('pub.refuse'), safeFirst: true };
}

// Une app veut que la page d'un formulaire prenne le lien public d'une autre page (contrats 3.3 point 6, 11.9 point 4a ; choix du porteur du 11/11 : « Au choix, non coché »). `shared` :
// { page, others: [{ page, tables }] } (js/sharing.js). Le clavier commence sur « Refuser » : un lien partagé n'est jamais le défaut.
export function sharedLinkQuestion({ t, app, shared }) {
  const items = shared.others.map(other => (other.tables.length
    ? t('sl.item', { page: other.page, n: other.tables.length, tables: other.tables.map(name => t('sl.quote', { name })).join(', ') })
    : t('sl.itemBare', { page: other.page })));
  return { title: t('sl.title'), message: t('sl.text', { app, page: shared.page }), items, note: t('sl.note'), confirmLabel: t('sl.allow'), cancelLabel: t('sl.refuse'), safeFirst: true };
}
