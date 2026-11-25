// Le message d'erreur du poids du document sous Firefox (règle du 03/11 : toute nouvelle interface ajoute ses mesures à test/interfaces-firefox.test.mjs ; demande du porteur du 25/11 : au-delà de 12 Go, un message
// d'erreur ; la limite dite est celle de La Suite numérique, 15 Go). Le vrai bandeau (js/weight/weight-alert.js) paraît dans le vrai explorateur de la page d'essai (test/pages/explorateur.js, `window.__alert`) : rien sous la limite ;
// au-dessus, un bandeau rouge en alerte, en haut de l'explorateur, qui dit le poids et la limite dans la langue ; le texte et le bouton tiennent dans la largeur, le bouton « Voir le détail » ouvre la fenêtre
// « Poids du document » à la vraie souris, Échap la ferme ; la liste garde sa place ; le bandeau s'en va quand le poids repasse sous la limite. Le contraste du texte rouge (4,5:1) se mesure dans le labo, dans un vrai Grist.
import { createI18n } from '../js/i18n/i18n.js';
import { alertText } from '../js/weight/weight-alert.js';
import { GO } from '../js/weight/weight-guard.js';
import { Run } from './corbeille-firefox.mjs';

function state() {
  const bar = document.querySelector('.ex-notices .banner--danger');
  const text = node => (node ? node.textContent.replace(/\s+/g, ' ').trim() : null);
  const scroll = document.querySelector('.ex-scroll');
  const modal = document.querySelector('.mod.wd');
  if (!bar) return { bar: null, banners: document.querySelectorAll('.ex-notices .banner').length, listHeight: Math.round(scroll.getBoundingClientRect().height), modal: Boolean(modal) };
  const box = bar.getBoundingClientRect();
  const root = document.querySelector('.ex').getBoundingClientRect();
  const label = bar.querySelector('.banner-text');
  const button = bar.querySelector('button');
  const at = button.getBoundingClientRect();
  const colors = getComputedStyle(bar);
  return {
    banners: document.querySelectorAll('.ex-notices .banner').length, role: bar.getAttribute('role'), text: text(label), button: text(button),
    first: document.querySelector('.ex-notices').firstElementChild === bar, height: Math.round(box.height), listHeight: Math.round(scroll.getBoundingClientRect().height),
    inside: box.left >= root.left - 1 && box.right <= root.right + 1 && at.left >= box.left - 1 && at.right <= box.right + 1 && at.height > 0,
    cut: label.scrollWidth > label.clientWidth + 1, twoLines: label.getBoundingClientRect().height < 40, red: colors.backgroundColor !== getComputedStyle(document.body).backgroundColor && colors.color !== colors.backgroundColor,
    icon: Boolean(bar.querySelector('svg')), modal: Boolean(modal),
  };
}

export async function poidsAlerteProblems(page, language, tag) {
  const found = [];
  const { t } = createI18n(language);
  const locale = language === 'en' ? 'en-GB' : 'fr-FR';
  const run = new Run(page, tag, found, 'message d\'erreur du poids');
  const expect = async (kind, what, test) => {
    let now = await page.run(state);
    for (let i = 0; i < 60 && !test(now); i += 1) { await new Promise(resolve => setTimeout(resolve, 75)); now = await page.run(state); }
    if (!test(now)) run.note(kind, `${what} (état : ${JSON.stringify(now).slice(0, 500)})`);
    return now;
  };
  try {
    await run.reset();
    // 1. Sous la limite : rien.
    await page.run(() => window.__alert(null));
    const quiet = await expect('rien sous la limite', 'aucun bandeau d\'erreur sous la limite', s => s.bar === null);
    const baseline = quiet.listHeight;
    // 2. Au-dessus : le bandeau, en alerte, en tête des avis, avec le poids et la limite.
    const bytes = 12.4 * GO;
    await page.run(value => window.__alert(value), bytes);
    const shown = await expect('bandeau', 'le bandeau devait paraître', s => s.bar !== null);
    const want = alertText(bytes, locale, t);
    if (shown.text !== want) run.note('texte', `le bandeau devait dire « ${want} » (il dit « ${shown.text} »)`);
    if (shown.role !== 'alert') run.note('alerte', `le bandeau devait être en alerte pour les lecteurs d'écran (rôle : ${shown.role})`);
    if (shown.button !== t('weight.alertDetail')) run.note('bouton', `le bouton devait dire « ${t('weight.alertDetail')} » (il dit « ${shown.button} »)`);
    if (!shown.first) run.note('place', 'le bandeau devait venir avant les autres avis');
    if (!shown.inside) run.note('mise en page', 'le bandeau et son bouton devaient tenir dans la largeur de l\'explorateur');
    if (shown.cut || !shown.twoLines) run.note('mise en page', 'le texte devait tenir sur deux lignes au plus, sans être coupé (à 700 px)');
    if (!shown.red || !shown.icon) run.note('aspect', 'le bandeau devait être rouge (fond différent du texte et de la page) et porter l\'icône d\'avertissement');
    if (shown.height > 64) run.note('mise en page', `le bandeau devait faire deux lignes au plus (hauteur ${shown.height} px)`);
    if (baseline - shown.listHeight > 48 || shown.listHeight < 150) run.note('mise en page', `la liste devait garder sa place (${baseline} px avant, ${shown.listHeight} px avec le bandeau)`);
    process.stderr.write(`poids-alerte : ${tag} : bandeau ${shown.height} px, liste ${baseline} → ${shown.listHeight} px, « ${shown.text} »\n`);
    // 3. Le bouton, à la vraie souris, ouvre la fenêtre du poids ; Échap la ferme.
    await run.clickSelector('[data-weight-alert]');
    await expect('détail', 'le bouton devait ouvrir la fenêtre « Poids du document »', s => s.modal);
    await page.press('Escape');
    await expect('détail', 'Échap devait fermer la fenêtre', s => !s.modal);
    // 4. Le poids change : le bandeau se redit ; sous la limite : il s'en va.
    await page.run(value => window.__alert(value), 13.3 * GO);
    await expect('mise à jour', 'le bandeau devait dire le nouveau poids', s => s.text === alertText(13.3 * GO, locale, t));
    await page.run(() => window.__alert(null));
    await expect('retrait', 'le bandeau devait s\'en aller sous la limite', s => s.bar === null && s.banners === 0);
  } catch (error) {
    run.note('geste impossible', String(error.message).slice(0, 200));
    await page.press('Escape').catch(() => {});
  }
  await page.run(() => window.__alert(null));
  await run.reset();
  return found;
}
