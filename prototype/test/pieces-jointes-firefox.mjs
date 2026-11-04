// La case « + pièces jointes » de l'explorateur sous Firefox (demande du porteur du 04/11, lot 2 du poids ; règle du 03/11 : toute nouvelle interface ajoute ses mesures à test/interfaces-firefox.test.mjs).
// Les gestes se font à la vraie souris et au vrai clavier de Firefox, sur la page d'essai (test/pages/explorateur.js : le vrai explorateur et le vrai calcul des pièces jointes, sur une table `_grist_Attachments` de
// doublure, de la forme que `fetchTable` la rend : un PDF, trois photos dont l'une est là deux fois, une pièce supprimée). Ce que Grist rend vraiment se mesure dans un vrai Grist (labo/run-poids.mjs).
// À chaque largeur, en clair et en sombre, à 100 % et à 150 % : rien ne se lit tant que la case n'est pas cochée ; à la souris, elle se coche et se décoche, le total prend les pièces jointes qui ne sont pas des
// fichiers de l'explorateur (la copie d'un même fichier comptée une fois, la pièce supprimée non comptée) et son infobulle dit d'où vient chaque part ; au clavier, elle est un arrêt de Tab avant la pastille des droits et « Ouvrir » ;
// avec le PDF dans la liste, sa pièce n'est pas recomptée ; un refus de Grist décoche la case et la grise avec la raison, que son clic redit sans relire ; le pied (total, case,
// boutons) ne se recouvre ni ne se coupe. Ce Firefox sans écran n'a pas le focus du système (`document.hasFocus()` est faux, `:focus` et `:focus-visible` ne s'appliquent jamais), n'active ni un bouton ni
// une case à Entrée ou Espace (les événements arrivent, aucun clic ne part : voir test/interfaces-firefox.test.mjs, conflictProblems) et sa touche Tab tourne en rond entre deux éléments après une réouverture de
// l'explorateur (mesuré le 04/11) : le trajet de Tab, l'anneau de focus et Espace sur la case se mesurent dans le labo, sous Chromium (labo/run-poids.mjs) ; ici, l'ordre des arrêts de Tab se lit dans le document.
import { createI18n } from '../js/i18n.js';
import { columnFaults, measureColumns } from '../labo/mesures-liste.mjs';
import { centerOfSelector, delay } from './corbeille-firefox.mjs';

// Les douze modèles de la page d'essai pèsent 18 971 940 octets ; sa table de pièces jointes compte 7 140 000 octets que nul fichier ne cite (le PDF de 640 000, trois photos de 2 000 000, 1 500 000 et 3 000 000
// octets : la copie de la deuxième et la pièce supprimée ne comptent pas). Avec le PDF dans la liste (sa ligne et sa pièce : 640 049 octets de plus), sa pièce n'est plus « autre » : 6 500 000 octets.
const TEXTS = {
  fr: { base: '18,1 Mo', other: '6,8 Mo', all: '24,9 Mo', pdfBase: '18,7 Mo', pdfOther: '6,2 Mo' },
  en: { base: '18.1 MB', other: '6.8 MB', all: '24.9 MB', pdfBase: '18.7 MB', pdfOther: '6.2 MB' },
};
const REASON = 'accès refusé';
const BOX = '.ex-pj input';

// Les arrêts de Tab du pied de fenêtre, dans l'ordre du document : la case, la pastille des droits (« droits »), puis « Ouvrir » et « Fermer » (un élément qu'un tabindex négatif ou `disabled` retire de la tabulation n'y est pas).
function tabStops() {
  return [...document.querySelectorAll('.ex-foot button, .ex-foot input')].filter(element => element.tabIndex >= 0 && !element.disabled && !element.closest('[inert], [hidden]'))
    .map(element => (element.matches('.ex-pj input') ? 'case' : (element.matches('.rights-chip') ? 'droits' : element.textContent.trim())));
}

// Ce que la page montre de la case et du total, et ce que l'explorateur a lu (`window.__attachments` compte les lectures de la table des pièces jointes).
function readFoot() {
  const input = document.querySelector('.ex-pj input');
  const total = document.querySelector('.ex-total');
  const label = document.querySelector('.ex-pj');
  return {
    checked: input.checked, grey: input.getAttribute('aria-disabled') === 'true' && label.classList.contains('is-grey'), busy: total.getAttribute('aria-busy') === 'true', total: total.querySelector('.tot-n').textContent,
    text: total.textContent, title: total.title, boxTitle: label.title, reads: window.__attachments, notices: [...window.__notices],
  };
}

export async function piecesJointesProblems(page, width, language, tag) {
  const found = [];
  const note = (kind, text) => found.push({ kind: `case « + pièces jointes » : ${kind}`, text: `${tag} : ${text}` });
  const { t } = createI18n(language);
  const x = TEXTS[language];
  const split = (list, pj, n) => t('weight.totalSplit', { list, pj, n });
  const foot = () => page.run(readFoot);
  // Attend que l'état de la page vérifie `check` (au plus 3 s) ; sinon un écart, `what` dit ce qui était attendu.
  const expect = async (kind, what, check) => {
    const started = Date.now();
    let state = await foot();
    while (!check(state) && Date.now() - started < 3000) { await delay(60); state = await foot(); }
    if (!check(state)) note(kind, `${what} (état : ${JSON.stringify({ checked: state.checked, grey: state.grey, busy: state.busy, total: state.total, reads: state.reads, notices: state.notices })})`);
    return state;
  };
  const clickBox = async () => page.click(...await page.run(centerOfSelector, BOX));

  // Départ propre : la case décochée, rien de lu.
  if ((await foot()).checked) await clickBox();
  await page.run(() => window.__reset());
  await expect('au départ', 'la case devait être décochée, dégrisée, sans lecture, le total à celui de la liste', state => !state.checked && !state.grey && state.reads === 0 && state.total === x.base);
  const start = await foot();
  if (start.text !== `${t('weight.total')} : ${x.base}`) note('texte du total au départ', `le total devait se lire « ${t('weight.total')} : ${x.base} », sans rien d'autre (il se lit « ${start.text} »)`);

  // 1. La souris : la case se coche, une lecture, le total prend les pièces qui ne sont pas des fichiers de l'explorateur, l'infobulle dit d'où il vient ; le pied tient.
  await clickBox();
  const checked = await expect('à la souris', `la case devait se cocher, lire une fois et dire ${x.all}`, state => state.checked && !state.busy && state.reads === 1 && state.total === x.all);
  if (checked.text !== `${t('weight.total')} : ${x.all}, ${split(x.base, x.other, 4)}`) note('texte du total', `case cochée, le total devait se lire « ${t('weight.total')} : ${x.all}, ${split(x.base, x.other, 4)} » (il se lit « ${checked.text} »)`);
  if (!checked.title.includes(split(x.base, x.other, 4))) note('infobulle du total', `l'infobulle devait dire « ${split(x.base, x.other, 4)} » (infobulle : « ${checked.title} »)`);
  found.push(...columnFaults(await page.run(measureColumns), width < 600, `${tag}, case cochée`, x.all));

  // 2. La souris encore : elle décoche (le total revient, rien n'est relu) puis recoche (une lecture de plus).
  await clickBox();
  await expect('décocher', `un clic sur la case cochée devait la décocher et ramener le total à ${x.base}, sans relire`, state => !state.checked && state.reads === 1 && state.total === x.base);
  await clickBox();
  await expect('recocher', `un clic de plus devait la recocher, relire une fois de plus et dire ${x.all}`, state => state.checked && state.reads === 2 && state.total === x.all);

  // 3. Le clavier : la case est un arrêt de Tab, avant la pastille des droits, « Ouvrir » et « Fermer ».
  const stops = await page.run(tabStops);
  const wanted = ['case', 'droits', t('ex.open'), t('ex.close')];
  if (stops.join('|') !== wanted.join('|')) note('arrêts de Tab', `les arrêts de Tab du pied devaient être ${wanted.join(', ')} : ${stops.join(', ')}`);

  // 4. Le PDF dans la liste, la case cochée : sa pièce n'est pas recomptée (le total reste à 24,9 Mo ; recomptée, il dirait 25,5 Mo) ; la liste est relue, donc les pièces aussi.
  await page.run(() => window.__withPdf());
  const withPdf = await expect('PDF dans la liste', `avec le PDF dans la liste et la case cochée, le total devait rester ${x.all} (sa pièce n'est pas recomptée), après une relecture`, state => state.checked && state.reads === 3 && state.total === x.all);
  if (!withPdf.title.includes(split(x.pdfBase, x.pdfOther, 3))) note('infobulle du total avec le PDF', `l'infobulle devait dire « ${split(x.pdfBase, x.pdfOther, 3)} » (infobulle : « ${withPdf.title} »)`);
  await clickBox();
  await expect('case décochée avec le PDF', `la case décochée devait ramener le total à ${x.pdfBase}`, state => !state.checked && state.total === x.pdfBase);

  // 5. Un refus de Grist : la case se décoche et se grise avec la raison ; son clic la redit (une phrase) sans relire ; une liste relue lui rend la main.
  await page.run(reason => { window.__reset(); window.__attachmentsFail = reason; }, REASON);
  await clickBox();
  const refused = await expect('refus de Grist', 'un refus devait décocher la case, la griser avec la raison, le total restant celui de la liste', state => !state.checked && state.grey && state.reads === 1 && state.total === x.base);
  if (refused.boxTitle !== t('weight.pjFailed', { reason: REASON })) note('raison du grisé', `l'infobulle de la case devait dire la raison (« ${t('weight.pjFailed', { reason: REASON })} »), elle dit « ${refused.boxTitle} »`);
  await clickBox();
  await expect('clic sur la case grisée', 'le clic sur la case grisée devait dire pourquoi, sans la cocher ni relire', state => !state.checked && state.reads === 1 && state.notices.includes(t('weight.pjFailed', { reason: REASON })));
  await page.run(() => { window.__attachmentsFail = ''; window.__reset(); });
  await expect('après une relecture des fichiers', 'la liste relue devait rendre la case dégrisée', state => !state.grey && !state.checked);
  return found;
}
