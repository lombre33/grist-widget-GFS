// La phrase du garde-fou des lectures complètes sous Firefox (règle du 03/11 : toute nouvelle interface ajoute ses mesures à test/interfaces-firefox.test.mjs ; choix du porteur du 25/11 : le garde-fou
// contre le redémarrage en boucle, js/explorer/read-guard.js). Quand GFS cesse de relancer la lecture d'une table que Grist coupe, la liste se montre sans les fichiers de l'app et un bandeau le dit, par
// la voie des apps qu'on n'a pas pu lire (`setStatus`, `problems`). La phrase est longue : elle doit tenir en entier dans la largeur, à 700 × 400, en alerte, sans chasser la liste. Ce que Grist fait
// vraiment (la coupure, le cadre reconstruit) se mesure dans un vrai Grist (faits vérifiés, 162).
import { createI18n } from '../js/i18n/i18n.js';
import { Run } from './corbeille-firefox.mjs';

function state() {
  const text = node => (node ? node.textContent.replace(/\s+/g, ' ').trim() : null);
  const scroll = document.querySelector('.ex-scroll');
  const bars = [...document.querySelectorAll('.ex-notices .banner')].filter(node => !node.classList.contains('banner--danger'));
  const listHeight = Math.round(scroll.getBoundingClientRect().height);
  if (!bars.length) return { bars: 0, listHeight, rows: document.querySelectorAll('.ls-row').length };
  const bar = bars[0];
  const box = bar.getBoundingClientRect();
  const root = document.querySelector('.ex').getBoundingClientRect();
  const colors = getComputedStyle(bar);
  return {
    bars: bars.length, role: bar.getAttribute('role'), text: text(bar), icon: Boolean(bar.querySelector('svg')), height: Math.round(box.height), listHeight,
    rows: document.querySelectorAll('.ls-row').length,
    inside: box.left >= root.left - 1 && box.right <= root.right + 1 && box.top >= 0 && box.bottom <= window.innerHeight,
    cut: bar.scrollWidth > bar.clientWidth + 1 || bar.scrollHeight > bar.clientHeight + 1 || colors.textOverflow === 'ellipsis',
    tinted: colors.backgroundColor !== getComputedStyle(document.body).backgroundColor && colors.color !== colors.backgroundColor,
  };
}

export async function lectureRetenueProblems(page, language, tag) {
  const found = [];
  const { t } = createI18n(language);
  const run = new Run(page, tag, found, 'lecture retenue par le garde-fou');
  const expect = async (kind, what, test) => {
    let now = await page.run(state);
    for (let i = 0; i < 40 && !test(now); i += 1) { await new Promise(resolve => setTimeout(resolve, 75)); now = await page.run(state); }
    if (!test(now)) run.note(kind, `${what} (état : ${JSON.stringify(now).slice(0, 500)})`);
    return now;
  };
  try {
    await run.reset();
    const quiet = await expect('au départ', 'aucun bandeau au départ', s => s.bars === 0);
    const want = t('ex.readHeld', { app: 'Publipostage+', reason: '' });
    await page.run(text => window.__explorer.setStatus({ problems: [text] }), want);
    const shown = await expect('bandeau', 'le bandeau devait paraître', s => s.bars === 1);
    if (shown.text !== want.replace(/\s+/g, ' ').trim()) run.note('texte', `le bandeau devait dire « ${want} » (il dit « ${shown.text} »)`);
    if (shown.role !== 'alert' || !shown.icon) run.note('alerte', `le bandeau devait être en alerte, avec l'icône d'avertissement (rôle : ${shown.role})`);
    if (!shown.inside || shown.cut) run.note('mise en page', 'la phrase devait tenir en entier dans la largeur de l\'explorateur, sans être coupée');
    if (!shown.tinted) run.note('aspect', 'le bandeau devait se détacher de la page');
    if (shown.height > 84) run.note('mise en page', `le bandeau devait faire trois lignes au plus à 700 px (hauteur ${shown.height} px)`);
    if (shown.rows !== quiet.rows || shown.listHeight < 110) run.note('mise en page', `la liste devait rester lisible sous le bandeau (${quiet.listHeight} px avant, ${shown.listHeight} px avec)`);
    process.stderr.write(`lecture-retenue : ${tag} : bandeau ${shown.height} px, liste ${quiet.listHeight} → ${shown.listHeight} px\n`);
    await page.run(() => window.__explorer.setStatus({ problems: [] }));
    const gone = await expect('retour', 'le bandeau devait partir quand la lecture reprend', s => s.bars === 0);
    if (gone.listHeight !== quiet.listHeight) run.note('retour', `la liste devait retrouver sa place (${quiet.listHeight} px, ${gone.listHeight} px)`);
  } catch (error) {
    run.note('essai', `l'essai s'est arrêté : ${String(error && error.message)}`);
  } finally {
    await page.run(() => window.__explorer.setStatus({ problems: [] })).catch(() => {});
  }
  return found;
}
