// La fenêtre « Envoyer à un autre document » sous Firefox (règle du 03/11 : toute nouvelle interface ajoute ses mesures à test/interfaces-firefox.test.mjs ; « Partager > Un autre document Grist… », 09/11).
// La vraie fenêtre (js/share-other-window.js) sur un parcours dont les réponses sont des doublures (test/pages/explorateur.js, `window.__sendOther`) : le moteur de partage et Grist se mesurent dans un vrai Grist
// (labo/run-partager-autre.mjs) ; ici, la mise en page et les gestes, à la vraie souris et au vrai clavier. À chaque écran (l'accord, le code, le document qui répond, l'envoi, la fin, l'échec) : la fenêtre tient
// dans la page, son titre et ses boutons restent en place, rien n'en sort, le clavier est sur le bon bouton ; l'accord n'écrit rien (Échap) ; « Contrôler la réponse » reste grisé tant que rien n'est collé et un
// refus du parcours est dit sans quitter l'écran ; la ligne « Un autre document Grist… » de « Partager » ouvre la fenêtre quand le contrôleur lui donne le geste, et Échap ne ferme que la fenêtre du dessus.
import { createI18n } from '../js/i18n.js';
import { Run } from './corbeille-firefox.mjs';

const LONG_DOC = 'Essai de réception du service de la comptabilité fournisseurs de la région Nord-Est';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Ce que la page montre de la fenêtre.
function state() {
  const modal = document.querySelector('.mod.so');
  const text = node => (node ? node.textContent.replace(/\s+/g, ' ').trim() : null);
  const out = { modal: null, acts: window.__sendActs || [], below: Boolean(document.querySelector('.mod.sh')) };
  if (!modal) return out;
  const box = modal.getBoundingClientRect();
  const head = modal.querySelector('.mod-head').getBoundingClientRect();
  const foot = modal.querySelector('.mod-foot').getBoundingClientRect();
  const active = document.activeElement;
  const outside = node => { const at = node.getBoundingClientRect(); return at.width > 0 && (at.right > box.right + 1 || at.left < box.left - 1); };
  const reply = modal.querySelector('[data-fk="so-reply"]');
  out.modal = {
    body: text(modal.querySelector('.rt-body')), note: text(modal.querySelector('.mod-note')), focus: active && active.dataset ? active.dataset.fk || null : null, inside: modal.contains(active),
    inPage: box.left >= 0 && box.top >= 0 && box.right <= window.innerWidth + 1 && box.bottom <= window.innerHeight + 1,
    sticky: head.bottom <= foot.top + 1 && foot.bottom <= box.bottom + 1 && head.top >= box.top - 1,
    outside: [...modal.querySelectorAll('.rt-body *, .mod-foot *, .mod-head *')].filter(outside).map(node => node.className || node.tagName).slice(0, 5),
    keys: [...modal.querySelectorAll('[data-fk]')].map(node => node.dataset.fk), greyed: [...modal.querySelectorAll('[aria-disabled="true"]')].map(node => node.dataset.fk),
    reply: reply ? reply.value : null, control: text(modal.querySelector('[data-fk="so-control"]')),
  };
  return out;
}

const centerOf = selector => { const node = document.querySelector(selector); if (!node) return null; node.scrollIntoView({ block: 'nearest' }); const box = node.getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; };

// La fenêtre ouverte d'un parcours (`kind`, voir test/pages/explorateur.js), et un petit jeu de gestes à la vraie souris.
function toolsFor(page, tag, found) {
  const run = new Run(page, tag, found, 'envoyer à un autre document');
  const snap = () => page.run(state);
  const expect = async (kind, what, test) => {
    let now = await snap();
    for (let i = 0; i < 40 && !test(now); i += 1) { await delay(75); now = await snap(); }
    if (!test(now)) run.note(kind, `${what} (état : ${JSON.stringify({ ...now, modal: now.modal && { ...now.modal, body: String(now.modal.body).slice(0, 90) } }).slice(0, 700)})`);
    return now;
  };
  const press = async (kind, key) => { const at = await page.run(centerOf, `[data-fk="${key}"]`); if (!at) { run.note(kind, `« ${key} » devait être dans la fenêtre`); return false; } await page.click(...at); return true; };
  // L'écran d'une fenêtre qui tient : dans la page, titre et boutons en place, rien qui sorte.
  const fits = (kind, now, what) => {
    if (!now.modal) return;
    if (!now.modal.inPage) run.note(kind, `${what} : la fenêtre devait tenir dans la page`);
    if (!now.modal.sticky) run.note(kind, `${what} : le titre et les boutons devaient rester en place`);
    if (now.modal.outside.length) run.note(kind, `${what} : rien ne devait sortir de la fenêtre (sort : ${now.modal.outside.join(', ')})`);
  };
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
  for (const part of [t('so.accord.adds'), t('so.accord.hook'), t('so.accord.keep')]) if (!now.modal.body.includes(part)) tools.run.note(kind, `l'accord devait dire « ${part} » (il dit « ${now.modal.body.slice(0, 160)} »)`);
  for (let i = 0; i < 3; i += 1) { await page.press('Tab'); const inside = await tools.snap(); if (!inside.modal || !inside.modal.inside) tools.run.note(kind, 'Tab devait rester dans la fenêtre'); }
  await page.press('Escape');
  const closed = await tools.expect(kind, 'Échap devait fermer la fenêtre', s => s.modal === null);
  if (closed.acts.some(act => act[0] === 'prepare' || act[0] === 'check' || act[0] === 'send')) tools.run.note(kind, 'fermer l\'accord ne devait rien demander au parcours');
}

// Le code, la réponse collée, le refus puis l'accord du parcours, le document qui répond, l'envoi et la fin.
async function sendingFlow(page, tools, t, flow) {
  const kind = flow === 'perso' ? 'espace personnel' : 'envoi';
  await tools.open(kind, flow);
  await tools.press(kind, 'so-continue');
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
  const verify = await tools.expect(kind, 'la réponse acceptée devait montrer le document, son lieu et le code de contrôle, le clavier sur « Envoyer le fichier »', s => s.modal && s.modal.keys.includes('so-send') && s.modal.focus === 'so-send' && s.modal.control === 'N5H-2AH');
  tools.fits(kind, verify, 'le document qui répond');
  const place = flow === 'perso' ? t('so.verify.personal') : t('so.verify.in', { folder: 'Comptabilité fournisseurs de la région Nord-Est', team: 'Grande équipe' });
  if (verify.modal && !(verify.modal.body.includes(LONG_DOC) && verify.modal.body.includes(place))) tools.run.note(kind, `l'écran devait dire le document et son lieu (« ${place} ») (il dit « ${verify.modal.body.slice(0, 200)} »)`);
  await tools.press(kind, 'so-send');
  const sending = await tools.expect(kind, 'l\'envoi devait montrer « envoi en cours » avec son seul bouton « Fermer »', s => s.modal && s.modal.keys.includes('so-close') && !s.modal.keys.includes('so-send') && s.acts.some(act => act[0] === 'send'));
  tools.fits(kind, sending, 'l\'envoi');
  await page.run(() => { window.__sendGo(); });
  const done = await tools.expect(kind, 'la fin devait dire que le partage est arrêté', s => s.modal && s.modal.body.includes(t('so.done.hint')));
  tools.fits(kind, done, 'la fin');
  await tools.press(kind, 'so-close');
  await tools.expect(kind, '« Fermer » devait fermer la fenêtre', s => s.modal === null);
}

// L'échec et ses issues : la préparation refusée (l'accord reste), l'envoi bloqué (« Arrêter le partage » défait), la fenêtre fermée en cours d'envoi (l'envoi se poursuit, un avis le dit).
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

// La ligne « Un autre document Grist… » de « Partager » (le contrôleur lui donne le geste d'ouvrir) : un clic ouvre la fenêtre d'envoi par-dessus ; Échap ne ferme qu'elle.
async function lineFlow(page, tools, t) {
  const kind = 'la ligne de « Partager »';
  await tools.run.reset();
  await page.run(() => { window.__shareSend = 'ok'; window.__sendActs = []; });
  const at = await page.run(() => { const row = [...document.querySelectorAll('.ls-row:not(.folder):not(.lk)')][0]; row.scrollIntoView({ block: 'nearest' }); const box = row.getBoundingClientRect(); return [box.left + Math.min(60, box.width / 2), box.top + box.height / 2]; });
  await page.run(name => { window.__shareKind = name; }, 'actif');
  await page.rightClick(...at);
  const entry = await page.run(label => { const node = [...document.querySelectorAll('.menu .menu-item')].find(item => item.textContent.trim().startsWith(label)); if (!node) return null; const box = node.getBoundingClientRect(); return [box.left + box.width / 2, box.top + box.height / 2]; }, t('share.menu'));
  if (!entry) { tools.run.note(kind, `le menu d'une ligne devait proposer « ${t('share.menu')} »`); return; }
  await page.click(...entry);
  await tools.expect(kind, 'la fenêtre « Partager » devait s\'ouvrir', s => s.below);
  if (!(await tools.press(kind, 'share-add'))) return;
  const line = `[data-fk="share-pick-${t('share.other')}"]`;
  const opened = await page.run(selector => { const node = document.querySelector(selector); return node ? node.getAttribute('aria-disabled') : 'absent'; }, line);
  if (opened !== null) { tools.run.note(kind, `la ligne « ${t('share.other')} » devait être dégrisée (aria-disabled : ${opened})`); await page.run(() => { window.__shareSend = null; }); await page.press('Escape'); return; }
  const at2 = await page.run(centerOf, line);
  await page.click(...at2);
  const send = await tools.expect(kind, 'un clic sur la ligne devait ouvrir l\'accord de l\'envoi, la fenêtre « Partager » dessous', s => s.modal && s.modal.keys.includes('so-continue') && s.below);
  tools.fits(kind, send, 'la fenêtre ouverte par la ligne');
  await page.press('Escape');
  await tools.expect(kind, 'Échap devait fermer la fenêtre d\'envoi seule, « Partager » restant', s => s.modal === null && s.below);
  await page.press('Escape');
  await page.run(() => { window.__shareSend = null; });
}

export async function partagerAutreProblems(page, language, tag) {
  const found = [];
  const t = createI18n(language).t;
  const tools = toolsFor(page, tag, found);
  try {
    await accordFlow(page, tools, t);
    await sendingFlow(page, tools, t, 'ok');
    await sendingFlow(page, tools, t, 'perso');
    await failureFlow(page, tools, t);
    await lineFlow(page, tools, t);
  } catch (error) {
    tools.run.note('geste impossible', String(error.message).slice(0, 200));
    await page.press('Escape').catch(() => {});
  }
  await tools.run.reset();
  return found;
}
