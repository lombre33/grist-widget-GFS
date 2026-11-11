// La fenêtre « Envoyer à un autre document » sous Firefox (règle du 03/11 : toute nouvelle interface ajoute ses mesures à test/interfaces-firefox.test.mjs ; « Partager > Un autre document Grist… », 09/11).
// La vraie fenêtre (js/share-other-window.js) sur un parcours dont les réponses sont des doublures (test/pages/explorateur.js, `window.__sendOther`) : le moteur de partage et Grist se mesurent dans un vrai Grist
// (labo/run-partager-autre.mjs) ; ici, la mise en page et les gestes, à la vraie souris et au vrai clavier. À chaque écran (l'accord, le code, le document qui répond, l'envoi, la fin, l'échec) : la fenêtre tient
// dans la page, son titre et ses boutons restent en place, rien n'en sort, le clavier est sur le bon bouton ; l'accord n'écrit rien (Échap) ; « Contrôler la réponse » reste grisé tant que rien n'est collé et un
// refus du parcours est dit sans quitter l'écran ; l'accord offre « Une copie, une fois » et « Une copie qui se met à jour » (la fin dit si le lien reste) ; l'onglet « Dans un autre document Grist » de « Partager »
// montre les documents reliés avec le niveau de CE fichier, un menu de niveaux (jamais masqué : grisé avec sa raison), « Relier un nouveau document… » ouvre l'accord par-dessus, et Échap ne ferme que la fenêtre du dessus.
import { createI18n } from '../js/i18n.js';
import { Run } from './corbeille-firefox.mjs';
import { LONG_DOC, windowMeasure, windowTools } from './fenetre-firefox.mjs';

// Ce que la page montre de l'onglet « Dans un autre document Grist » de la fenêtre « Partager » (null si elle n'est pas ouverte) : ce qui lui est propre ; le reste (titre, corps, place) vient de `windowMeasure`.
function shareTabOwn() {
  const share = document.querySelector('.mod.sh');
  if (!share) return null;
  const text = node => (node ? node.textContent.replace(/\s+/g, ' ').trim() : null);
  return {
    tabs: [...share.querySelectorAll('.mg-tab')].map(node => [node.dataset.fk, node.getAttribute('aria-selected')]),
    links: [...share.querySelectorAll('.rr[data-link]')].map(row => ({ id: row.dataset.link, level: row.dataset.level, label: text(row.querySelector('.lvl')), locked: row.querySelector('.lvl').getAttribute('aria-disabled') === 'true', tag: text(row.querySelector('.tag')) })),
    fresh: (() => { const node = share.querySelector('[data-fk="other-new"]'); return node ? node.getAttribute('aria-disabled') === 'true' : null; })(),
    menu: [...document.querySelectorAll('.menu .menu-item')].map(node => ({ text: text(node), greyed: node.getAttribute('aria-disabled') === 'true' })),
  };
}

// Ce que la page montre de la fenêtre « Envoyer » et, dessous, de « Partager » : les mesures communes (test/fenetre-firefox.mjs), la réponse collée, le code de contrôle, les actes que les parcours ont notés.
async function measure(page) {
  const out = await page.run(windowMeasure, '.mod.so', '.rt-body', { reply: ['[data-fk="so-reply"]', 'value'], control: ['[data-fk="so-control"]', 'text'] }, { acts: ['__sendActs', []], shareActs: ['__shareActs', []] });
  const share = await page.run(windowMeasure, '.mod.sh', '.sh-body', {}, {});
  out.below = share.modal !== null;
  out.tab = share.modal && { ...share.modal, ...(await page.run(shareTabOwn)) };
  return out;
}

// La fenêtre ouverte d'un parcours (`kind`, voir test/pages/explorateur.js), et un petit jeu de gestes à la vraie souris.
function toolsFor(page, tag, found) {
  const run = new Run(page, tag, found, 'envoyer à un autre document');
  const snap = () => measure(page);
  const { expect, press, fits } = windowTools(page, run, snap);
  const open = async (kind, flow) => {
    await run.reset();
    await page.run(name => { window.__sendOther(name); }, flow);
    return expect(kind, 'la fenêtre devait s\'ouvrir sur l\'accord, le clavier sur « Continuer »', s => s.modal && s.modal.keys.includes('so-continue') && s.modal.focus === 'so-continue');
  };
  const type = text => page.press(...text.split(''));
  return { run, snap, expect, press, fits, open, type };
}

// L'accord : ce que GFS ajoute, rien d'écrit avant le « Continuer » ; Tab reste dans la fenêtre, Échap la ferme sans rien demander au parcours.
async function accordFlow(page, tools, t) {
  const kind = 'accord';
  const now = await tools.open(kind, 'ok');
  if (!now.modal) return;
  tools.fits(kind, now, 'l\'accord');
  const radios = await page.run(() => ['once', 'live'].map(mode => { const node = document.querySelector(`[data-fk="so-mode-${mode}"]`); return node ? node.checked : null; }));
  if (radios[0] !== true || radios[1] !== false) tools.run.note(kind, `l'accord devait proposer « ${t('so.mode.once')} » (coché) et « ${t('so.mode.live')} » (état des deux choix : ${JSON.stringify(radios)})`);
  for (const part of [t('so.mode.once'), t('so.mode.live')]) if (!now.modal.body.includes(part)) tools.run.note(kind, `l'accord devait dire « ${part} »`);
  for (const part of [t('so.accord.adds'), t('so.accord.hook'), t('so.accord.keep')]) if (!now.modal.body.includes(part)) tools.run.note(kind, `l'accord devait dire « ${part} » (il dit « ${now.modal.body.slice(0, 160)} »)`);
  // « Exiger la comparaison du code de contrôle » : proposé et coché au départ (décision du 09/11, audit de sécurité), décochable à la vraie souris.
  const strict = () => page.run(() => { const node = document.querySelector('[data-fk="so-strict"]'); return node ? node.checked : null; });
  if (!now.modal.body.includes(t('so.strict'))) tools.run.note(kind, `l'accord devait proposer « ${t('so.strict')} »`);
  if ((await strict()) !== true) tools.run.note(kind, '« exiger le code » devait être coché au départ');
  await tools.press(kind, 'so-strict');
  if ((await strict()) !== false) tools.run.note(kind, 'un clic sur « exiger le code » devait le décocher');
  await tools.press(kind, 'so-strict');
  if ((await strict()) !== true) tools.run.note(kind, 'un second clic devait le recocher');
  for (let i = 0; i < 3; i += 1) { await page.press('Tab'); const inside = await tools.snap(); if (!inside.modal || !inside.modal.inside) tools.run.note(kind, 'Tab devait rester dans la fenêtre'); }
  await page.press('Escape');
  const closed = await tools.expect(kind, 'Échap devait fermer la fenêtre', s => s.modal === null);
  if (closed.acts.some(act => act[0] === 'prepare' || act[0] === 'check' || act[0] === 'send')) tools.run.note(kind, 'fermer l\'accord ne devait rien demander au parcours');
}

// Le code, la réponse collée, le refus puis l'accord du parcours, le document qui répond, l'envoi et la fin.
async function sendingFlow(page, tools, t, flow, mode = 'once', strict = true) {
  const kind = (flow === 'perso' ? 'espace personnel' : (mode === 'live' ? 'copie qui se met à jour' : 'envoi')) + (strict ? '' : ' sans exiger le code');
  await tools.open(kind, flow);
  if (mode === 'live') {
    await tools.press(kind, 'so-mode-live');
    const chosen = await tools.expect(kind, 'choisir la copie qui se met à jour devait le cocher et dire que le lien reste', s => s.modal && s.modal.body.includes(t('so.accord.hook.live')));
    tools.fits(kind, chosen, 'l\'accord du lien qui reste');
  }
  if (!strict) await tools.press(kind, 'so-strict');
  await tools.press(kind, 'so-continue');
  await tools.expect(kind, `le parcours devait recevoir le choix « ${mode} » et « exiger le code » : ${strict}`, s => s.acts.some(act => act[0] === 'mode' && act[1] === mode && act[2] === strict));
  const code = await tools.expect(kind, 'le code devait s\'afficher, le clavier dessus, « Contrôler » grisé', s => s.modal && s.modal.keys.includes('so-code') && s.modal.focus === 'so-code' && s.modal.greyed.includes('so-check'));
  tools.fits(kind, code, 'le code');
  if (code.modal && !code.modal.body.includes(t('so.code.hint', { n: 7 }))) tools.run.note(kind, `le code devait dire sa durée (« ${t('so.code.hint', { n: 7 })} »)`);
  await tools.press(kind, 'so-copy');
  await tools.expect(kind, 'copier devait dire « copié » ou « sélectionné »', s => s.modal && [t('so.code.copied'), t('so.code.select')].includes(s.modal.note));
  await tools.press(kind, 'so-check');
  if ((await tools.snap()).acts.some(act => act[0] === 'check')) tools.run.note(kind, '« Contrôler » grisé ne devait rien demander au parcours');
  await tools.press(kind, 'so-reply');
  await tools.type('abc');
  await tools.expect(kind, 'une réponse saisie devait dégriser « Contrôler »', s => s.modal && s.modal.reply === 'abc' && !s.modal.greyed.includes('so-check'));
  await tools.press(kind, 'so-check');
  const refused = await tools.expect(kind, 'un refus devait être dit, sans quitter l\'écran', s => s.modal && s.modal.note === t('so.failed', { message: 'Ce texte n’est pas un code de synchro.' }) && s.modal.keys.includes('so-reply'));
  tools.fits(kind, refused, 'le refus');
  await tools.press(kind, 'so-reply');
  await page.chord('Control', 'a');
  await tools.type('GRISTSYNC2.z');
  await tools.press(kind, 'so-check');
  const focusKey = strict ? 'so-compared' : 'so-send';
  const verify = await tools.expect(kind, `la réponse acceptée devait montrer le document, son lieu et le code de contrôle, le clavier sur « ${strict ? t('so.compared') : t('so.send')} »`, s => s.modal && s.modal.keys.includes('so-send') && s.modal.focus === focusKey && s.modal.control === 'N5H-2AH');
  tools.fits(kind, verify, 'le document qui répond');
  const place = flow === 'perso' ? t('so.verify.personal') : t('so.verify.in', { folder: 'Comptabilité fournisseurs de la région Nord-Est', team: 'Grande équipe' });
  if (verify.modal && !(verify.modal.body.includes(LONG_DOC) && verify.modal.body.includes(place))) tools.run.note(kind, `l'écran devait dire le document et son lieu (« ${place} ») (il dit « ${verify.modal.body.slice(0, 200)} »)`);
  if (verify.modal && verify.modal.keys.includes('so-compared') !== strict) tools.run.note(kind, `la case « ${t('so.compared')} » devait ${strict ? 'être là' : 'être absente'}`);
  if (strict) {
    // Exigé : « Envoyer » reste grisé et muet tant que la case n'est pas cochée ; la case le dégrise ; la décocher le regrise.
    if (verify.modal && !verify.modal.greyed.includes('so-send')) tools.run.note(kind, '« Envoyer » devait être grisé tant que le code n\'est pas comparé');
    await tools.press(kind, 'so-send');
    if ((await tools.snap()).acts.some(act => act[0] === 'send')) tools.run.note(kind, '« Envoyer » grisé ne devait rien demander au parcours');
    await tools.press(kind, 'so-compared');
    await tools.expect(kind, 'cocher « j\'ai comparé » devait dégriser « Envoyer »', s => s.modal && !s.modal.greyed.includes('so-send'));
    await tools.press(kind, 'so-compared');
    await tools.expect(kind, 'décocher « j\'ai comparé » devait regriser « Envoyer »', s => s.modal && s.modal.greyed.includes('so-send'));
    await tools.press(kind, 'so-compared'); // Espace sur une case ne se joue pas ici (Firefox sans écran, voir test/interfaces-firefox.test.mjs) : la souris la recoche
    await tools.expect(kind, 'recocher « j\'ai comparé » devait dégriser « Envoyer »', s => s.modal && !s.modal.greyed.includes('so-send'));
  }
  await tools.press(kind, 'so-send');
  const sending = await tools.expect(kind, 'l\'envoi devait montrer « envoi en cours » avec son seul bouton « Fermer »', s => s.modal && s.modal.keys.includes('so-close') && !s.modal.keys.includes('so-send') && s.acts.some(act => act[0] === 'send' && act[2] === strict));
  tools.fits(kind, sending, 'l\'envoi');
  await page.run(() => { window.__sendGo(); });
  const done = await tools.expect(kind, mode === 'live' ? 'la fin devait dire que le lien reste' : 'la fin devait dire que le partage est arrêté', s => s.modal && s.modal.body.includes(t(mode === 'live' ? 'so.done.live.hint' : 'so.done.hint')) && s.acts.some(act => act[0] === 'send' && act[1] === mode));
  tools.fits(kind, done, 'la fin');
  await tools.press(kind, 'so-close');
  await tools.expect(kind, '« Fermer » devait fermer la fenêtre', s => s.modal === null);
}

// L'échec et ses issues : la préparation refusée (l'accord reste), l'envoi bloqué (« Arrêter le partage » défait), la fenêtre fermée en cours d'envoi (l'envoi se poursuit, un avis le dit).
// Relier deux documents sans fichier : pas de nom de fichier ni de choix une fois / à jour, rien n'est envoyé maintenant ; le code, la réponse, le document qui répond, puis « relié » (rien n'est parti).
async function linkFlow(page, tools, t) {
  const kind = 'relier sans fichier';
  const now = await tools.open(kind, 'lien');
  if (!now.modal) return;
  tools.fits(kind, now, 'l\'accord du lien');
  if (!now.modal.body.includes(t('so.link.lead')) || now.modal.keys.some(key => key.startsWith('so-mode-')) || !now.modal.body.includes(t('so.accord.hook.live'))) tools.run.note(kind, `l'accord devait dire que rien n'est envoyé maintenant, sans choix une fois / à jour (il dit « ${now.modal.body.slice(0, 200)} »)`);
  if (!now.modal.title.includes(t('so.title.link'))) tools.run.note(kind, `le titre devait être « ${t('so.title.link')} » (il est « ${now.modal.title} »)`);
  await tools.press(kind, 'so-continue');
  await tools.expect(kind, 'le parcours devait recevoir « à jour » (le lien reste)', s => s.acts.some(act => act[0] === 'mode' && act[1] === 'live'));
  await tools.expect(kind, 'le code devait s\'afficher', s => s.modal && s.modal.keys.includes('so-code'));
  await tools.press(kind, 'so-reply');
  await tools.type('GRISTSYNC2.z');
  await tools.press(kind, 'so-check');
  const verify = await tools.expect(kind, 'la réponse acceptée devait montrer le document et le code de contrôle', s => s.modal && s.modal.keys.includes('so-send') && s.modal.control === 'N5H-2AH');
  tools.fits(kind, verify, 'le document qui répond');
  await tools.press(kind, 'so-compared');
  await tools.press(kind, 'so-send');
  const sending = await tools.expect(kind, 'l\'envoi devait dire que le lien se met en place', s => s.modal && s.modal.body.includes(t('so.sending.link')) && s.modal.keys.includes('so-close'));
  tools.fits(kind, sending, 'le lien en cours');
  await page.run(() => { window.__sendGo(); });
  const done = await tools.expect(kind, 'la fin devait dire que les documents sont reliés et que rien n\'est parti', s => s.modal && s.modal.body.includes(t('so.done.link.hint')) && s.modal.body.includes(t('so.done.link', { doc: LONG_DOC })));
  tools.fits(kind, done, 'la fin du lien');
  await tools.press(kind, 'so-close');
  await tools.expect(kind, '« Fermer » devait fermer la fenêtre', s => s.modal === null);
}

async function failureFlow(page, tools, t) {
  let kind = 'préparation refusée';
  await tools.open(kind, 'refus');
  await tools.press(kind, 'so-continue');
  const refused = await tools.expect(kind, 'le refus devait être dit, l\'accord resté', s => s.modal && s.modal.note === t('so.failed', { message: 'Grist a refusé la création' }) && s.modal.keys.includes('so-continue') && !s.modal.greyed.includes('so-continue'));
  tools.fits(kind, refused, 'le refus');
  await page.press('Escape');
  kind = 'envoi bloqué';
  const reach = async flow => {
    await tools.open(kind, flow);
    await tools.press(kind, 'so-continue');
    await tools.expect(kind, 'le code devait s\'afficher', s => s.modal && s.modal.keys.includes('so-reply'));
    await tools.press(kind, 'so-reply');
    await tools.type('GRISTSYNC2.z');
    await tools.press(kind, 'so-check');
    await tools.expect(kind, 'le document devait s\'afficher', s => s.modal && s.modal.keys.includes('so-send'));
    await tools.press(kind, 'so-compared');
    await tools.press(kind, 'so-send');
  };
  await reach('bloque');
  await page.run(() => { window.__sendGo(); });
  const blocked = await tools.expect(kind, 'l\'envoi bloqué devait le dire, avec « Arrêter le partage » et « Fermer »', s => s.modal && s.modal.keys.includes('so-stop') && s.modal.body.includes(t('so.error.blocked')));
  tools.fits(kind, blocked, 'l\'échec');
  await tools.press(kind, 'so-stop');
  const stopped = await tools.expect(kind, '« Arrêter le partage » devait fermer la fenêtre et défaire', s => s.modal === null && s.acts.filter(act => act[0] === 'abort').length >= 1);
  if (stopped.modal !== null) await page.press('Escape');
  kind = 'fermée pendant l\'envoi';
  await reach('ok');
  await tools.press(kind, 'so-close');
  await tools.expect(kind, 'fermer en cours d\'envoi devait fermer la fenêtre', s => s.modal === null);
  await page.run(() => { window.__sendGo(); });
  await tools.expect(kind, 'l\'envoi devait finir sans la fenêtre et le dire par un avis', s => s.acts.some(act => act[0] === 'notice' && String(act[1]).includes(LONG_DOC)));
}

// L'onglet « Dans un autre document Grist » de « Partager » (le contrôleur lui donne ses liens) : trois liens (à jour, en attente, bloqué) avec le niveau de CE fichier ; le menu des niveaux ; un lien qui attend sa
// réponse est verrouillé avec sa raison ; « Relier un nouveau document… » ouvre l'accord par-dessus ; Échap ne ferme que lui. Sans lien ou sans pouvoir les lire, l'onglet le dit et garde son bouton.
async function openShareTab(page, tools, t, kind, links) {
  await tools.run.reset();
  await page.run(name => { window.__shareOther = true; window.__shareSend = 'ok'; window.__sendActs = []; window.__links = name; window.__shareKind = 'actif'; }, links);
  const at = await page.run(() => { const row = [...document.querySelectorAll('.ls-row:not(.folder):not(.lk)')][0]; row.scrollIntoView({ block: 'nearest' }); const box = row.getBoundingClientRect(); return [box.left + Math.min(60, box.width / 2), box.top + box.height / 2]; });
  await page.rightClick(...at);
  const entry = await page.run(label => { const node = [...document.querySelectorAll('.menu .menu-item')].find(item => item.textContent.trim().startsWith(label)); if (!node) return null; const box = node.getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; }, t('share.menu'));
  if (!entry) { tools.run.note(kind, `le menu d'une ligne devait proposer « ${t('share.menu')} »`); return false; }
  await page.click(...entry);
  await tools.expect(kind, 'la fenêtre « Partager » devait s\'ouvrir avec ses deux onglets', s => s.tab && s.tab.tabs.length === 2 && s.tab.body && !s.tab.body.includes(t('share.loading')));
  return tools.press(kind, 'share-tab-other');
}

async function tabFlow(page, tools, t) {
  const kind = 'l\'onglet de « Partager »';
  if (!(await openShareTab(page, tools, t, kind, 'actifs'))) return;
  const open = await tools.expect(kind, 'l\'onglet devait montrer les trois liens, chacun avec le niveau de ce fichier', s => s.tab && s.tab.links.length === 3);
  const tab = open.tab;
  if (!tab || tab.links.length !== 3) return;
  const by = id => tab.links.find(link => link.id === id);
  if (tab.tabs.find(item => item[0] === 'share-tab-other')[1] !== 'true') tools.run.note(kind, 'l\'onglet « Dans un autre document Grist » devait être le choisi');
  if (!tab.inPage || !tab.sticky || tab.outside.length) tools.run.note(kind, `la fenêtre devait tenir dans la page, titre et bouton en place, rien ne sortir (sort : ${tab.outside.join(', ')})`);
  const expectLink = (id, level, label, tag, locked) => {
    const link = by(id);
    if (!link || link.level !== level || link.label !== label || link.tag !== tag || link.locked !== locked) tools.run.note(kind, `le lien ${id} devait dire « ${label} » (${level}), l'état « ${tag} », verrouillé : ${locked} (il dit ${JSON.stringify(link)})`);
  };
  expectLink('e1', 'live', t('so.level.live'), t('so.state.active'), false);
  expectLink('e2', 'none', t('so.level.none'), t('so.state.pending'), true);
  expectLink('e3', 'none', t('so.level.none'), t('so.state.blocked'), false);
  // Un lien qui attend sa réponse : verrouillé, un clic dit pourquoi, aucun menu.
  await tools.press(kind, 'other-level-e2');
  const waiting = await tools.expect(kind, 'un lien en attente devait dire pourquoi, sans menu', s => s.tab && s.tab.note === t('so.link.pending'));
  if (waiting.tab && waiting.tab.menu.length) tools.run.note(kind, 'un lien en attente ne devait ouvrir aucun menu');
  // Le menu des niveaux d'un fichier pas partagé : « Arrêter la copie » grisé avec sa raison, jamais masqué ; « Copie à jour » écrit le niveau.
  await tools.press(kind, 'other-level-e3');
  const menu = await tools.expect(kind, 'le menu devait proposer les trois niveaux', s => s.tab && s.tab.menu.length === 3);
  if (menu.tab && menu.tab.menu.length === 3) {
    const [once, live, stop] = menu.tab.menu;
    if (!once.text.startsWith(t('so.level.once')) || !live.text.startsWith(t('so.level.live')) || !stop.text.startsWith(t('so.level.stop'))) tools.run.note(kind, `le menu devait proposer « ${t('so.level.once')} », « ${t('so.level.live')} » puis « ${t('so.level.stop')} » (il propose ${JSON.stringify(menu.tab.menu)})`);
    if (!stop.greyed || once.greyed || live.greyed) tools.run.note(kind, `seul « ${t('so.level.stop')} » devait être grisé pour un fichier pas partagé`);
  }
  const itemAt = label => page.run(wanted => { const node = [...document.querySelectorAll('.menu .menu-item')].find(item => item.textContent.trim().startsWith(wanted)); if (!node) return null; const box = node.getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; }, label);
  const live = await itemAt(t('so.level.live'));
  if (live) { await page.click(...live); await tools.expect(kind, 'le choix devait demander le niveau « à jour »', s => s.shareActs.some(act => act[0] === 'level' && act[1] === 'e3' && act[2] === 'live')); }
  // « Une copie, une fois » : l'avis dit que le fichier part, sans attendre la fin.
  await tools.press(kind, 'other-level-e1');
  await tools.expect(kind, 'le menu devait s\'ouvrir', s => s.tab && s.tab.menu.length === 3);
  const once = await itemAt(t('so.level.once'));
  if (once) { await page.click(...once); await tools.expect(kind, 'une copie une fois devait demander ce niveau et dire que le fichier part', s => s.shareActs.some(act => act[0] === 'level' && act[1] === 'e1' && act[2] === 'once') && s.tab && s.tab.note === t('so.once.going', { name: 'Facture.pdf' })); }
  // Un fichier déjà à jour : « Arrêter la copie » est libre.
  await tools.press(kind, 'other-level-e1');
  const menu2 = await tools.expect(kind, 'le menu d\'un fichier à jour devait s\'ouvrir', s => s.tab && s.tab.menu.length === 3);
  if (menu2.tab && menu2.tab.menu.length === 3 && menu2.tab.menu[2].greyed) tools.run.note(kind, '« Arrêter la copie » devait être libre pour un fichier à jour');
  const stop = await itemAt(t('so.level.stop'));
  if (stop) { await page.click(...stop); await tools.expect(kind, 'arrêter la copie devait demander le niveau « pas partagé »', s => s.shareActs.some(act => act[0] === 'level' && act[1] === 'e1' && act[2] === 'none')); }
  // « Relier un nouveau document… » : l'accord par-dessus, la fenêtre « Partager » dessous ; Échap ne ferme que lui.
  await tools.press(kind, 'other-new');
  const send = await tools.expect(kind, 'un clic devait ouvrir l\'accord de l\'envoi, la fenêtre « Partager » dessous', s => s.modal && s.modal.keys.includes('so-continue') && s.below);
  tools.fits(kind, send, 'la fenêtre ouverte par « Relier un nouveau document… »');
  await page.press('Escape');
  await tools.expect(kind, 'Échap devait fermer la fenêtre d\'envoi seule, « Partager » restant', s => s.modal === null && s.below);
  await page.press('Escape');
}

// Sans lien, ou quand les liens ne se lisent pas : l'onglet le dit et garde « Relier un nouveau document… ».
async function emptyTabFlow(page, tools, t) {
  for (const [links, said] of [['aucun', t('so.tab.none')], ['illisible', t('so.tab.unreadable')]]) {
    const kind = `l'onglet de « Partager » (${links})`;
    if (!(await openShareTab(page, tools, t, kind, links))) continue;
    const now = await tools.expect(kind, `l'onglet devait dire « ${said} » et garder son bouton`, s => s.tab && s.tab.body.includes(said) && s.tab.fresh === false);
    if (now.tab && (now.tab.links.length || !now.tab.inPage || !now.tab.sticky || now.tab.outside.length)) tools.run.note(kind, 'aucun lien ne devait se dessiner, la fenêtre devait tenir dans la page');
    await page.press('Escape');
  }
}

export async function partagerAutreProblems(page, language, tag) {
  const found = [];
  const t = createI18n(language).t;
  const tools = toolsFor(page, tag, found);
  try {
    await accordFlow(page, tools, t);
    await sendingFlow(page, tools, t, 'ok');
    await sendingFlow(page, tools, t, 'ok', 'live');
    await sendingFlow(page, tools, t, 'perso');
    await sendingFlow(page, tools, t, 'ok', 'once', false);
    await linkFlow(page, tools, t);
    await failureFlow(page, tools, t);
    await tabFlow(page, tools, t);
    await emptyTabFlow(page, tools, t);
  } catch (error) {
    tools.run.note('geste impossible', String(error.message).slice(0, 200));
    await page.press('Escape').catch(() => {});
  }
  await page.run(() => { window.__shareOther = false; window.__shareSend = null; window.__links = null; });
  await tools.run.reset();
  return found;
}
