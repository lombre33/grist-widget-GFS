// Form+ (non modifiée, référencée à 39e0740) dans GFS, dans un vrai Grist (consigne 007) : à la vraie souris et au vrai clavier, à 700 × 400.
//   1. L'app s'ouvre dans le sous-cadre isolé, sans refus du courtier ni erreur de script.
//   2. Ce que le courtier refuse à ses deux écritures de définition (`options` de la section, lecture de `_grist_Shares`) et ce que devient `setOptions` : mesuré depuis le
//      cadre de l'app, avec les mêmes appels que `persistOptions`, `duplicateFormSection` et `findExistingShareKey` ; rien n'est écrit (le courtier refuse avant Grist).
//   3. « Partir de zéro » passe avec le manifeste de Form+ (table, section de formulaire) ; Grist recharge alors le cadre de GFS, et le retrait du champ automatique est perdu.
//   4. Le type « Formulaire » dans l'explorateur, quand une table `FormPlus_Formulaires` existe (la forme que la consigne 007 demande à l'app).
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { startLab } from './lab-setup.mjs';
import { seedForms } from './seed.mjs';
import { say, check } from './lab-common.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `form-${lang}-${scheme}`;
const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const refusals = [];
const errors = [];
page.on('console', message => {
  if (message.type() === 'warning' && message.text().startsWith('GFS')) refusals.push(message.text());
  if (message.type() === 'error' && /apps\/form\//.test(message.location().url || '')) errors.push(message.text());
});
page.on('pageerror', error => errors.push(error.message));

// Ce que le document contient : les tables, les sections (type, page) et les champs de la section de formulaire.
const documentState = target => target.evaluate(async () => {
  const tables = await grist.docApi.listTables();
  const sections = await grist.docApi.fetchTable('_grist_Views_section');
  const fields = await grist.docApi.fetchTable('_grist_Views_section_field');
  return {
    tables,
    sections: sections.id.map((id, i) => ({ id, kind: sections.parentKey[i], page: sections.parentId[i], options: sections.options[i] })),
    fields: fields.id.map((id, i) => ({ id, section: fields.parentId[i] })),
  };
});

// ----- 1. L'app s'ouvre.
const app = await lab.openApp('form', /apps\/form\//);
check('l\'app a un cadre', Boolean(app));
await page.waitForTimeout(4000);
await lab.fitPanel(undefined, 700, 400);
const seen = await app.evaluate(() => ({
  origine: window.origin,
  titre: document.title,
  texte: document.body.innerText.replace(/\s+/g, ' ').slice(0, 160),
  stockage: (() => { try { localStorage.setItem('x', '1'); return 'ok'; } catch (error) { return error.name; } })(),
}));
say('ce que l\'app voit :', JSON.stringify(seen));
await lab.shotPanel(run, '1-demarrage');
check('l\'app est ouverte dans le sous-cadre isolé (origine null, pas de stockage)', seen.origine === 'null' && seen.stockage === 'SecurityError', seen);
check('elle propose ses départs', /Comment voulez-vous démarrer|How do you want to start/i.test(seen.texte), seen.texte);
check('le courtier ne lui a rien refusé au démarrage', refusals.length === 0, refusals);
check('aucune erreur de script dans l\'app', errors.length === 0, errors);
const before = await documentState(lab.frame);
const gfsSection = before.sections.find(section => section.kind === 'custom');

// ----- 2. Les écritures de définition de Form+ et le courtier.
const attempt = (name, call) => app.evaluate(async ({ name, call }) => {
  try {
    const value = await (new Function('grist', `return (${call})();`))(grist);
    return { name, refused: false, value: value === undefined ? null : JSON.stringify(value).slice(0, 80) };
  } catch (error) {
    return { name, refused: true, message: String((error && error.message) || error) };
  }
}, { name, call });
const options = await attempt('options', `async () => grist.docApi.applyUserActions([['UpdateRecord', '_grist_Views_section', ${gfsSection.id}, { options: JSON.stringify({ formplusDuplicate: true }) }]])`);
const shares = await attempt('shares', 'async () => grist.docApi.fetchTable(\'_grist_Shares\')');
const marker = await attempt('marqueur', `async () => grist.docApi.applyUserActions([['UpdateRecord', '_grist_Views_section', ${gfsSection.id}, { shareOptions: '{}', options: '{}' }]])`);
const setOptions = await attempt('setOptions', 'async () => grist.setOptions({ formTitle: \'Inscription\', questions: [{ id: 1 }], shareKey: \'AAAA\' })');
const readBack = await attempt('getOptions', 'async () => grist.getOptions()');
for (const item of [options, shares, marker, setOptions, readBack]) say(`${item.name} :`, JSON.stringify(item));
check('l\'écriture de `options` d\'une section est refusée par le courtier (contrats 3.3, point 6)', options.refused && /GFS_REFUSE|refus|options/i.test(options.message), options);
check('la lecture de `_grist_Shares` est refusée (contrats 3.2, point 4)', shares.refused && /GFS_REFUSE|refus|_grist_Shares/i.test(shares.message), shares);
check('le lot qui écrit `shareOptions` ET `options` est refusé en entier (contrats 3.3, point 1)', marker.refused, marker);
check('`setOptions` de tout l\'objet ne dit rien et n\'écrit rien : aucune clé de Form+ n\'est déclarée', !setOptions.refused && (readBack.value === null || readBack.value === 'null'), { setOptions, readBack });
const afterRefusals = await documentState(lab.frame);
check('rien n\'a été écrit dans les sections du document par ces essais', JSON.stringify(afterRefusals.sections) === JSON.stringify(before.sections), 'les lignes de _grist_Views_section sont les mêmes');
refusals.length = 0;

// ----- 3. « Partir de zéro » : la table et la section de formulaire.
await app.locator('[data-startgo="scratch"]').click();
await page.waitForTimeout(500);
await lab.shotPanel(run, '2-partir-de-zero');
await app.locator('#scratchCreate').click();
await page.waitForTimeout(6000);
check('« Partir de zéro » : le courtier ne refuse rien (AddTable, CreateViewSection)', refusals.length === 0, refusals);
const frames = page.frames().filter(frame => /\/prototype\//.test(frame.url()) && !/\/labo\//.test(frame.url()));
check('Grist a rechargé le cadre de GFS (une section de plus sur la page) : plus de cadre d\'app', frames.every(frame => !/\/apps\/form\//.test(frame.url())), frames.map(frame => frame.url().replace(/^http:\/\/127\.0\.0\.1:\d+/, '')));
const reloaded = await lab.gfsFrame(/access=full/);
await lab.gfsReady(reloaded);
await lab.shot(run, '3-apres-creer-page');
const created = await documentState(reloaded);
const formSection = created.sections.find(section => section.kind === 'form');
say('document après :', JSON.stringify({ tables: created.tables, formSection: formSection && { id: formSection.id, page: formSection.page }, gfsSection: gfsSection.id }));
check('la table des réponses est créée (« Reponses » / « Responses », Grist en retire l\'accent)', created.tables.filter(name => !before.tables.includes(name)).length === 1, created.tables);
check('une section de formulaire est posée sur la page de GFS', Boolean(formSection) && formSection.page === gfsSection.page, formSection);
// Grist recharge le cadre dès que la section est posée : le retrait du champ que Grist ajoute tout seul, que Form+ fait ensuite, ne passe pas. Même résultat sans GFS (`run-form-seul`).
say('champs restés dans la section de formulaire :', created.fields.filter(field => formSection && field.section === formSection.id).length);
check('GFS repart de zéro : l\'explorateur, plus d\'app', await reloaded.locator('.ex-title-row').count() > 0);

// ----- 4. Le type « Formulaire » dans l'explorateur.
say('semis des formulaires :', JSON.stringify(await seedForms(reloaded)));
await reloaded.evaluate(() => location.reload());
await page.waitForTimeout(1000);
const explorer = await lab.gfsFrame(/access=full/);
await lab.gfsReady(explorer);
await page.waitForTimeout(800);
await lab.fitPanel(explorer, 700, 400);
const rows = await explorer.locator('.ls-row').evaluateAll(list => list.map(row => ({
  nom: row.querySelector('.t')?.textContent, type: row.querySelector('.pill')?.textContent, icone: row.querySelector('.nm use')?.getAttribute('href'), famille: row.getAttribute('data-fam'),
})));
say('lignes de l\'explorateur :', JSON.stringify(rows));
await lab.shotPanel(run, '4-explorateur', explorer);
const forms = rows.filter(row => row.icone === '#i-form');
check('les formulaires de Form+ sont dans l\'explorateur, avec l\'icône « formulaire »', forms.length === 3, forms);
check('leur type s\'écrit « Formulaire » / « Form » dans la langue de la personne', forms.every(row => row.type === (lang === 'fr' ? 'Formulaire' : 'Form')), forms.map(row => row.type));
check('sans couleur de famille (la couleur est réservée au document, à la grille et à la présentation)', forms.every(row => !row.famille), forms.map(row => row.famille));
await explorer.locator('.ls-row', { hasText: forms[0] && forms[0].nom }).first().click();
say('barre d\'information :', (await explorer.locator('.inf').innerText()).replace(/\s+/g, ' '));
await explorer.locator('.ls-row', { hasText: forms[0] && forms[0].nom }).first().dblclick();
await page.waitForTimeout(800);
say('après le double-clic :', JSON.stringify({ cadres: page.frames().filter(frame => /\/apps\/form\//.test(frame.url())).length, panneau: (await explorer.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').slice(0, 220) }));
await lab.shotPanel(run, '5-double-clic', explorer);
check('aucun refus du courtier depuis l\'explorateur', refusals.length === 0, refusals);
await lab.browser.close();
