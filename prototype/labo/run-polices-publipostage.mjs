// L'extension « Polices » de Publipostage+ (sa demande du 12/11, `GFS-ETAT.md` : la police Marianne de l'État dans le PDF ; manifeste `extensions[]`, contrats 2.6) dans un vrai Grist (grist-static), avec la
// vraie app, à 700 × 400, à la vraie souris (Playwright : événements du pointeur du navigateur, jamais dispatchEvent). LAB_LANG=fr|en, LAB_SCHEME=light|dark. Ce que la passe mesure :
//   1. la fenêtre « Apps et extensions » a sa ligne « Polices » (jamais grisée, rien à choisir : pas de bibliothèque), le texte de GFS, son poids du manifeste (≈ 8 Ko), décochée au départ ;
//   2. l'app ouverte ne la reçoit pas tant que la personne n'a pas coché (`GfsLink.extensions()`), rien n'est chargé ;
//   3. la case cochée à la souris : l'app apprend `polices` sans que son cadre soit rechargé, GFS ne lui donne aucune bibliothèque pour elle ;
//   4. la case décochée : l'app ne l'a plus, et le cadre n'a toujours pas été rechargé ; aucun avertissement de GFS.
// Marianne elle-même vient du CDN de l'État (jsDelivr, paquet `@gouvfr/dsfr`) au gré de la personne, pas de GFS : elle ne se mesure pas d'ici (le conteneur du cloud n'atteint pas jsDelivr).
import { startLab } from './lab-setup.mjs';
import { seedFiles } from './seed.mjs';
import { say, check } from './lab-common.mjs';
import { collectWarnings, waiter } from './lab-gestes.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const run = `polices-publipostage-${lang}-${scheme}`;
const FK = 'ext:publipostage/polices';
const WORDS = {
  fr: { name: 'Polices', text: /Ajoute la police Marianne de l.État aux PDF, quand la personne dit avoir le droit de s.en servir/, size: /^≈\s8\sKo$/ },
  en: { name: 'Fonts', text: /Adds the State.s Marianne font to PDFs, when the person says they are entitled to use it/, size: /^≈\s8\sKB$/ },
}[lang];

const lab = await startLab({ lang, colorScheme: scheme });
const { page } = lab;
const warnings = collectWarnings(page);
await lab.fitPanel(undefined, 700, 400);
await seedFiles(lab.frame);
const frame = lab.frame;
const waitFor = waiter(page, 60);
const line = () => frame.locator(`[data-row="${FK}"]`);
const box = () => frame.locator(`input[data-fk="${FK}"]`);
const received = () => app.evaluate(() => GfsLink.extensions());

// ---------- 1. la ligne de la fenêtre ----------
await lab.openModules(frame);
await line().waitFor();
const text = (await line().innerText()).replace(/\s+/g, ' ');
const sizes = await line().locator('.sz').allInnerTexts();
const facts = await line().evaluate(node => ({ over: node.scrollWidth - node.clientWidth, modes: node.querySelectorAll('.mr-mode').length, libs: node.querySelectorAll('.mr-lib').length }));
say('la ligne :', text, sizes, facts);
check('la ligne « Polices » dit ce qu\'elle apporte (Marianne, à la déclaration de la personne), sans choix de bibliothèque, avec son poids du manifeste', text.includes(WORDS.name) && WORDS.text.test(text)
  && facts.modes === 0 && facts.libs === 0 && sizes.length === 1 && WORDS.size.test(sizes[0].trim()), { text, sizes, facts });
check('décochée au départ, jamais grisée, tenue dans le panneau de 700 × 400', !(await box().isChecked()) && (await box().isEnabled()) && facts.over <= 0, facts);
await lab.shotPanel(run, '1-ligne', frame);

// ---------- 2. l'app ouverte ne la reçoit pas encore ----------
await frame.locator('[data-open="publipostage"]').click();
const app = await lab.appFrame(/publipostage/);
await app.waitForFunction(() => { const e = document.getElementById('status-msg'); return Boolean(e && e.textContent); }, null, { timeout: 30000 });
await page.waitForTimeout(800);
const before = app.url();
check('l\'app ouverte ne reçoit pas « polices » tant que la case n\'est pas cochée', !(await received()).includes('polices'), await received());

// ---------- 3. la case cochée ----------
await lab.openModules(frame);
await box().check();
await lab.settle(frame);
await waitFor('l\'extension reçue par l\'app', async () => (await received()).includes('polices'));
const given = await app.evaluate(() => ({ list: GfsLink.extensions(), library: typeof GfsLink.library === 'function' ? GfsLink.library('polices') : null }));
check('cochée à la souris : l\'app apprend « polices » sans que son cadre soit rechargé, et GFS ne lui donne aucune bibliothèque pour elle', given.list.includes('polices') && !given.library && app.url() === before, given);
await lab.shotPanel(run, '2-cochee', frame);

// ---------- 4. la case décochée ----------
await box().uncheck();
await lab.settle(frame);
await waitFor('l\'extension retirée', async () => !(await received()).includes('polices'));
check('décochée : l\'app ne l\'a plus, son cadre n\'a toujours pas été rechargé', !(await received()).includes('polices') && app.url() === before && !app.isDetached());
check('aucun avertissement de GFS pendant la passe', warnings.length === 0, warnings.map(each => each.slice(0, 120)));
await lab.browser.close();
