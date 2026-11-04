// Les doublures des tests des fichiers que GFS garde (js/kept-files.js, contrats 6.6) : le document de la page (le champ « file » caché du sélecteur), le magasin de données et le rangement.
// Les fenêtres (nom pris, confirmation) et le vrai sélecteur de fichier se jouent dans le labo, avec une vraie souris (labo/run-pdf.mjs, labo/run-ranger-pdf.mjs) ; `conflict` est la doublure de la
// fenêtre du nom pris : elle rend ce que la personne aurait choisi.
import { KeptFiles } from '../js/kept-files.js';
import { createI18n } from '../js/i18n.js';

export const FR = createI18n('fr');
export const EN = createI18n('en');
export const PDF_BYTES = '%PDF-1.4\n1 0 obj\n';
export const entryOf = (kept, over = {}) => ({ ...kept.importEntries()[0], ...over });

// Un document de faux : le champ « file » caché que `pickFile` pose, qu'on remplit ensuite comme le ferait la personne.
export function fakeDoc() {
  const doc = { appended: [], body: { append: node => doc.appended.push(node) } };
  doc.createElement = tag => {
    const element = Object.assign(new EventTarget(), { tag, files: null, removed: false, clicks: 0, hidden: false });
    element.remove = () => { element.removed = true; };
    element.click = () => { element.clicks += 1; };
    return element;
  };
  return doc;
}

export function setup({ fullAccess = true, readonly = false, folder = '', add = async () => ({ status: 'added', id: 'aa', name: 'Facture.pdf', row: 1 }), download = async () => ({ blob: new Blob(['x']), name: 'Facture.pdf' }), i18n = FR, setFiling = async () => {}, reader, conflict, session } = {}) {
  const log = { notices: [], hidden: [], adds: [], refreshes: 0, filings: [], doc: fakeDoc() };
  const store = { add: async options => { log.adds.push(options); return add(options); }, download, remove: async () => true };
  const kept = new KeptFiles({
    store, doc: log.doc, container: null, inertTargets: () => [], t: i18n.t, lang: () => i18n.lang, locale: () => 'fr-FR', now: () => 1762000000000,
    fullAccess: () => fullAccess, readonly: () => readonly, notice: text => log.notices.push(text), hideNotice: said => log.hidden.push(said), refresh: async () => { log.refreshes += 1; },
    folder: () => folder, rangement: { setFiling: async entries => { log.filings.push(entries); return setFiling(entries); } }, ...(reader ? { reader } : {}), ...(conflict ? { conflict } : {}), ...(session ? { session } : {}),
  });
  // La personne choisit `file` dans le sélecteur ouvert par `importFile`.
  const importing = (file, entry = entryOf(kept)) => {
    const running = kept.importFile(entry);
    const input = log.doc.appended.at(-1);
    input.files = file ? [file] : [];
    input.dispatchEvent(new Event('change'));
    return running;
  };
  return { kept, log, importing };
}

export const pdf = (name = 'Facture.pdf', content = PDF_BYTES) => new File([content], name, { type: 'application/pdf' });

