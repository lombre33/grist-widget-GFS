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
