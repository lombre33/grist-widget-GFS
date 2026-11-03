// Un PDF d'essai valide, écrit à la main, sans bibliothèque : `pages` pages A4 de texte en Helvetica (une police standard, non incorporée), un cadre plein pour qu'il y ait de l'encre, et
// une ligne de texte accentué (WinAnsi : les accents du latin 1 s'écrivent tels quels). Le lecteur y retrouve le texte (`getTextContent`), le nombre de pages et un dessin.
// Les octets ne changent pas d'un appel à l'autre : le labo compare des empreintes.

const escape = text => text.replace(/[\\()]/g, match => `\\${match}`);

// Le texte de chaque page : ce que les essais cherchent dans la couche de texte.
export const pageTitle = (title, number) => `${title} numero ${number}`;
export const ACCENTED_LINE = 'Elephant a l\'ete : éléphant, à l\'été, 12 °C';

export function makePdf({ pages = 3, title = 'Facture' } = {}) {
  const parts = [];
  const offsets = [];
  let length = 0;
  const push = text => { const bytes = Buffer.from(text, 'latin1'); parts.push(bytes); length += bytes.length; };
  const object = (number, body) => { offsets[number] = length; push(`${number} 0 obj\n${body}\nendobj\n`); };
  push('%PDF-1.4\n%âãÏÓ\n');
  // 1 : le catalogue, 2 : l'arbre des pages, 3 : la police ; ensuite, par page, l'objet de la page puis son contenu.
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  const kids = Array.from({ length: pages }, (_, index) => `${4 + index * 2} 0 R`).join(' ');
  object(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages} >>`);
  object(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  for (let index = 0; index < pages; index++) {
    const content = [
      '0.9 0.9 1 rg 72 640 451 40 re f 0 g',
      `BT /F1 24 Tf 80 650 Td (${escape(pageTitle(title, index + 1))}) Tj ET`,
      `BT /F1 12 Tf 72 600 Td (${escape(ACCENTED_LINE)}) Tj ET`,
      `BT /F1 12 Tf 72 580 Td (Page ${index + 1} sur ${pages}) Tj ET`,
    ].join('\n');
    object(4 + index * 2, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + index * 2} 0 R >>`);
    object(5 + index * 2, `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`);
  }
  const count = 4 + pages * 2;
  const xref = length;
  push(`xref\n0 ${count}\n0000000000 65535 f \n${offsets.slice(1, count).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return Buffer.concat(parts);
}
