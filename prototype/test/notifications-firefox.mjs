// La cloche « Notifications » et « Prévenir par e-mail » sous Firefox (règle du 03/11 : toute nouvelle interface ajoute ses mesures à test/interfaces-firefox.test.mjs ; choix du porteur du 25/11 : la cloche annonce
// ce qu'on lui donne, « lu » se garde dans une table du document, un bouton prévient par e-mail). Le vrai explorateur, le vrai menu de la cloche (js/sharing/notifications.js) et la vraie fenêtre « Partager »
// (js/sharing/share-window.js, js/sharing/share-mail-button.js) sur un faux magasin de « lu » (test/pages/explorateur.js, `window.__given`) ; le magasin et la table se mesurent dans un vrai Grist (labo/). Ici,
// la mise en page à 700 × 400 et les gestes, à la vraie souris et au vrai clavier :
//   la cloche : la pastille dit le nombre de notifications non lues (contraste 4,5:1, sans couvrir un autre bouton), le menu nomme chaque chose donnée (fichier, dossier, espace), une chose lue n'y est plus, il tient
//   dans 700 × 400 sans texte coupé, « Tout marquer comme lu » et « Ouvrir « Partagés avec moi » » finissent la liste, Échap le ferme ; un clic sur une chose donnée la marque lue et l'ouvre ; « Tout marquer comme lu »
//   marque tout ; sans rien de non lu, la ligne « Aucune notification » et « Tout marquer comme lu » restent, grisés, et leur clic dit pourquoi ;
//   « Prévenir par e-mail » : le bouton est dans le pied de « Partager », grisé avec sa raison tant qu'aucune adresse n'est ajoutée (son clic ne fait rien d'autre que la dire), il s'allume dès qu'une adresse est ajoutée à
//   la vraie souris, avec un lien « mailto: » qui nomme l'adresse, le pied de la fenêtre tient dans 700 px sans que rien n'en sorte.
import { createI18n } from '../js/i18n/i18n.js';
import { givenLabel } from '../js/sharing/notifications.js';
import { Run, delay } from './corbeille-firefox.mjs';

// Ce que la personne voit (s'exécute dans la page : rien du module n'y est visible).
function state() {
  const text = node => (node ? node.textContent.replace(/\s+/g, ' ').trim() : null);
  const box = node => { const at = node.getBoundingClientRect(); return { l: at.left, t: at.top, r: at.right, b: at.bottom }; };
  const channels = value => (String(value).match(/[\d.]+/g) || []).slice(0, 3).map(Number);
  const light = value => { const [r, g, b] = channels(value).map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const ratio = (a, b) => { const [hi, lo] = [light(a), light(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
  const cut = [...document.querySelectorAll('.ex *')].filter(node => {
    const style = getComputedStyle(node);
    const clipped = (style.textOverflow === 'ellipsis' && node.scrollWidth > node.clientWidth + 1) || (style.getPropertyValue('-webkit-line-clamp') !== 'none' && node.scrollHeight > node.clientHeight + 1);
    return clipped && !node.closest('[title]') && !node.getAttribute('aria-label');
  }).map(node => `${node.className || node.tagName} « ${text(node).slice(0, 40)} »`);
  const bell = document.querySelector('.tb-bell');
  const badge = bell && bell.querySelector('.tb-badge');
  const menuBox = document.querySelector('.menu');
  const rail = document.querySelector('.tr-row[data-view="shared"]');
  const modal = document.querySelector('.mod.sh');
  const out = {
    cut, page: { w: window.innerWidth, h: window.innerHeight },
    bell: bell ? {
      label: bell.getAttribute('aria-label'), badge: badge && !badge.hidden ? text(badge) : null, box: box(bell),
      badgeBox: badge && !badge.hidden ? box(badge) : null, badgeContrast: badge && !badge.hidden ? ratio(getComputedStyle(badge).color, getComputedStyle(badge).backgroundColor) : null,
      others: ['.tb-group', '[aria-label][aria-haspopup="menu"]:not(.tb-bell)'].map(selector => document.querySelector(`.ex-title-row ${selector}`)).filter(Boolean).map(box),
      grow: box(document.querySelector('.ex-title-row .grow')),
    } : null,
    menuBox: menuBox ? box(menuBox) : null,
    menu: [...document.querySelectorAll('.menu .menu-item')].map(item => ({ label: text(item.querySelector('.menu-label')), grey: item.getAttribute('aria-disabled') === 'true' })),
    marked: window.__noticeMarked ? JSON.stringify(window.__noticeMarked) : null,
    notices: window.__notices.slice(),
    shared: Boolean(rail && rail.getAttribute('aria-current') === 'true'),
    crumbs: text(document.querySelector('.crumbs')),
    modal: null,
  };
  if (modal) {
    const frame = modal.getBoundingClientRect();
    const head = modal.querySelector('.mod-head').getBoundingClientRect();
    const foot = modal.querySelector('.mod-foot');
    const footBox = foot.getBoundingClientRect();
    const mail = modal.querySelector('[data-fk="share-mail"]');
    const outside = node => { const at = node.getBoundingClientRect(); return at.width > 0 && (at.right > frame.right + 1 || at.left < frame.left - 1); };
    out.modal = {
      mail: mail ? { label: text(mail), href: mail.getAttribute('href'), grey: mail.getAttribute('aria-disabled') === 'true', title: mail.getAttribute('title'), box: box(mail) } : null,
      keys: [...foot.querySelectorAll('[data-fk]')].map(node => node.dataset.fk), note: text(modal.querySelector('.mod-note')),
      inPage: frame.left >= 0 && frame.top >= 0 && frame.right <= window.innerWidth + 1 && frame.bottom <= window.innerHeight + 1,
      sticky: head.bottom <= footBox.top + 1 && footBox.bottom <= frame.bottom + 1,
      outside: [...modal.querySelectorAll('.mod-foot *')].filter(outside).map(node => node.className || node.tagName).slice(0, 5),
      footHeight: Math.round(footBox.height), form: Boolean(modal.querySelector('.sg-new')),
    };
  }
  return out;
}

const LONG = 'Facture de la session de formation de septembre 2026 pour la région Nord-Est.pdf';
const GIVEN = [
  { cle: 'fichier|k1', type: 'fichier', cible: 'k1', nom: 'Contrat de formation.pdf', par: 'camille.durand@example.com', lu: false },
  { cle: 'dossier|dossier:marc@example.com/Formation', type: 'dossier', cible: 'dossier:marc@example.com/Formation', nom: 'Formation', par: 'marc@example.com', lu: false },
  { cle: 'espace|compta', type: 'espace', cible: 'compta', nom: 'Comptabilité', path: 'Espaces/Comptabilité', par: '', lu: false },
  { cle: 'fichier|k2', type: 'fichier', cible: 'k2', nom: LONG, par: 'camille.durand@example.com', lu: true },
];

export async function notificationsProblems(page, language, tag) {
  const found = [];
  const t = createI18n(language).t;
  const run = new Run(page, tag, found, 'notifications');
  const snap = () => page.run(state);
  const expect = async (kind, what, test) => {
    let now = await snap();
    for (let i = 0; i < 40 && !test(now); i += 1) { await delay(75); now = await snap(); }
    if (!test(now)) run.note(kind, `${what} (état : ${JSON.stringify({ ...now, cut: undefined, bell: now.bell && { badge: now.bell.badge, label: now.bell.label } }).slice(0, 600)})`);
    return now;
  };
  const overlap = (a, b) => a.l < b.r - 1 && a.r > b.l + 1 && a.t < b.b - 1 && a.b > b.t + 1;
  const openBell = async what => { await run.clickSelector('.tb-bell'); return expect('la cloche', what, s => s.menu.length > 0); };
  const unread = GIVEN.filter(item => !item.lu);
  try {
    await run.reset();

    // La cloche : trois choses non lues (la quatrième est lue).
    await page.run(items => window.__given(items), GIVEN);
    const first = await expect('la cloche', 'la pastille devait dire 3', s => s.bell && s.bell.badge === '3');
    const bell = first.bell;
    if (bell) {
      if (bell.label !== t('nt.tipCount', { n: 3 })) run.note('la cloche', `le nom de la cloche devait être « ${t('nt.tipCount', { n: 3 })} » (il est « ${bell.label} »)`);
      if (bell.box.l < bell.grow.r - 1) run.note('la cloche', 'la cloche devait rester à droite du titre, avec les autres boutons');
      if (bell.others.some(other => overlap(bell.box, other) || (bell.badgeBox && overlap(bell.badgeBox, other)))) run.note('la cloche', 'la cloche et sa pastille ne devaient couvrir aucun autre bouton');
      if (bell.badgeBox && (bell.badgeBox.r > first.page.w || bell.badgeBox.t < 0)) run.note('la cloche', 'la pastille devait tenir dans la page');
      if (bell.badgeContrast !== null && bell.badgeContrast < 4.5) run.note('la cloche', `le nombre de la pastille devait avoir un contraste de 4,5:1 au moins (il est de ${bell.badgeContrast.toFixed(2)})`);
    }
    const menu = await openBell('le menu de la cloche devait s\'ouvrir');
    const labels = menu.menu.map(item => item.label);
    const wanted = [...unread.map(item => givenLabel(t, item)), t('nt.markAll'), t('nt.open')];
    if (JSON.stringify(labels) !== JSON.stringify(wanted)) run.note('la cloche', `le menu devait nommer les trois choses données, puis « ${t('nt.markAll')} » et « ${t('nt.open')} » (il dit ${JSON.stringify(labels)})`);
    if (labels.includes(givenLabel(t, GIVEN[3]))) run.note('la cloche', 'une chose déjà lue ne devait plus être dans le menu');
    if (menu.menu.some(item => item.grey)) run.note('la cloche', 'avec des choses non lues, aucune ligne du menu ne devait être grisée');
    const at = menu.menuBox;
    if (!at || at.l < 0 || at.t < 0 || at.r > menu.page.w + 1 || at.b > menu.page.h + 1) run.note('la cloche', `le menu devait tenir dans la page (${JSON.stringify(at)})`);
    if (menu.cut.length) run.note('la cloche', `un texte coupé devait avoir son texte entier au survol : ${menu.cut.slice(0, 3).join(' ; ')}`);
    await page.press('Escape');
    await expect('la cloche', 'Échap devait fermer le menu', s => s.menu.length === 0);

    // Un clic sur une chose donnée : elle se marque lue (elle seule) et s'ouvre ; ici un fichier, donc « Partagés avec moi ».
    await openBell('le menu de la cloche devait se rouvrir');
    await run.clickSelector('.menu .menu-item:nth-child(1)');
    const clicked = await expect('un clic', 'un clic sur un fichier donné devait le marquer lu', s => s.marked === JSON.stringify([['fichier|k1']]));
    if (!clicked.shared) run.note('un clic', 'un clic sur un fichier donné devait ouvrir « Partagés avec moi »');
    if (clicked.menu.length) run.note('un clic', 'le menu devait se fermer après le clic');

    // Un espace donné s'ouvre dans son dossier.
    await openBell('le menu devait se rouvrir');
    await run.clickSelector('.menu .menu-item:nth-child(3)');
    const space = await expect('un clic', 'un clic sur un espace donné devait le marquer lu', s => s.marked === JSON.stringify([['fichier|k1'], ['espace|compta']]));
    if (!space.crumbs || !space.crumbs.includes('Comptabilité')) run.note('un clic', `un clic sur un espace donné devait ouvrir son dossier (le fil d'Ariane dit « ${space.crumbs} »)`);

    // « Tout marquer comme lu » : une seule demande, pour tout.
    await openBell('le menu devait se rouvrir');
    await run.clickSelector('.menu .menu-item:nth-last-child(2)');
    await expect('tout marquer', '« Tout marquer comme lu » devait demander de tout marquer', s => s.marked === JSON.stringify([['fichier|k1'], ['espace|compta'], 'all']));

    // Plus rien de non lu : la ligne et « Tout marquer comme lu » restent, grisés, et disent pourquoi.
    await page.run(() => window.__given([]));
    const quiet = await expect('rien à lire', 'sans notification, la pastille devait disparaître', s => s.bell && s.bell.badge === null);
    if (quiet.bell && quiet.bell.label !== t('nt.tip')) run.note('rien à lire', `le nom de la cloche devait être « ${t('nt.tip')} » (il est « ${quiet.bell.label} »)`);
    const none = await openBell('le menu devait s\'ouvrir');
    if (JSON.stringify(none.menu.map(item => [item.label, item.grey])) !== JSON.stringify([[t('nt.none'), true], [t('nt.markAll'), true], [t('nt.open'), false]])) {
      run.note('rien à lire', `le menu devait garder « ${t('nt.none')} » et « ${t('nt.markAll')} » grisés, puis « ${t('nt.open')} » (il dit ${JSON.stringify(none.menu)})`);
    }
    await run.clickSelector('.menu .menu-item:nth-last-child(2)');
    const why = await expect('rien à lire', 'le clic sur « Tout marquer comme lu » grisé devait dire pourquoi', s => s.notices.includes(t('nt.markAllWhy')));
    if (why.marked !== '[]') run.note('rien à lire', 'une ligne grisée ne devait rien marquer');

    // « Prévenir par e-mail » dans « Partager » : grisé sans adresse, allumé quand une adresse est ajoutée, le pied tient dans 700 px.
    await run.reset();
    await page.run(() => { window.__share('actif'); });
    const opened = await expect('prévenir', 'la fenêtre « Partager » devait s\'ouvrir avec « Prévenir par e-mail » dans son pied', s => s.modal && s.modal.mail);
    const mail = opened.modal && opened.modal.mail;
    if (mail) {
      if (mail.label !== t('share.mail')) run.note('prévenir', `le bouton devait dire « ${t('share.mail')} » (il dit « ${mail.label} »)`);
      if (!mail.grey || mail.href) run.note('prévenir', 'sans adresse ajoutée, le bouton devait être grisé et sans lien');
      if (mail.title !== t('share.mail.none')) run.note('prévenir', `le bouton grisé devait dire pourquoi : « ${t('share.mail.none')} » (il dit « ${mail.title} »)`);
      if (opened.modal.keys.join() !== 'share-mail,share-manage,share-close') run.note('prévenir', `le pied devait porter « Prévenir par e-mail », « Gérer les partages… » puis « Terminé » (il porte ${opened.modal.keys.join(', ')})`);
      if (!opened.modal.inPage || !opened.modal.sticky || opened.modal.outside.length) run.note('prévenir', `le pied devait tenir dans la fenêtre à 700 px (sort : ${opened.modal.outside.join(', ') || 'rien'}, dans la page : ${opened.modal.inPage})`);
    }
    await run.clickSelector('[data-fk="share-mail"]');
    const said = await expect('prévenir', 'le clic sur le bouton grisé devait dire pourquoi dans le pied', s => s.modal && s.modal.note === t('share.mail.none'));
    if (said.modal && said.modal.mail && said.modal.mail.href) run.note('prévenir', 'le clic sur le bouton grisé ne devait rien ouvrir');

    // Une adresse ajoutée à la vraie souris allume le bouton, avec un lien « mailto: » qui la nomme.
    await run.clickSelector('[data-fk="share-add"]');
    await expect('prévenir', 'le champ devait ouvrir sa liste', s => s.modal && s.modal.form === false);
    if (await run.clickSelector('[data-fk="share-pick-collegue@example.com"]')) {
      await expect('prévenir', 'le formulaire devait se montrer', s => s.modal && s.modal.form);
      await run.clickSelector('[data-fk="share-confirm"]');
      const lit = await expect('prévenir', 'l\'adresse ajoutée devait allumer « Prévenir par e-mail » avec un lien « mailto: » à son nom',
        s => s.modal && s.modal.mail && !s.modal.mail.grey && /^mailto:/.test(s.modal.mail.href || '') && decodeURIComponent(s.modal.mail.href).includes('collegue@example.com'));
      if (lit.modal && lit.modal.mail) {
        if (lit.modal.mail.title !== t('share.mail.tip', { n: 1 })) run.note('prévenir', `le bouton allumé devait dire « ${t('share.mail.tip', { n: 1 })} » (il dit « ${lit.modal.mail.title} »)`);
        if (!lit.modal.inPage || !lit.modal.sticky || lit.modal.outside.length) run.note('prévenir', `le pied devait tenir dans la fenêtre une fois le bouton allumé (sort : ${lit.modal.outside.join(', ') || 'rien'})`);
      }
    }
    await page.press('Escape');
    await delay(100);
  } catch (error) {
    run.note('essai', `l'essai a échoué : ${error && error.message ? error.message : error}`);
  }
  return found;
}
