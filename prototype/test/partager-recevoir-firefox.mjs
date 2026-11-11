// La fenêtre « Recevoir d'un autre document Grist » sous Firefox (règle du 03/11 : toute nouvelle interface ajoute ses mesures à test/interfaces-firefox.test.mjs ; « Nouveau > Importer > D'un autre document Grist… », 09/11).
// La vraie fenêtre (js/sharing/share-receive-window.js) sur un parcours dont les réponses sont des doublures (test/pages/explorateur.js, `window.__receive`) : le moteur et Grist se mesurent dans un vrai Grist (labo/run-partager-recevoir.mjs) ;
// ici, la mise en page et les gestes, à la vraie souris et au vrai clavier. À chaque écran (le code à coller, l'accord, le lien du formulaire, la réponse) : la fenêtre tient dans la page, son titre et ses boutons restent en place,
// rien n'en sort, le clavier est sur le bon bouton ; « Continuer » reste grisé tant que rien n'est collé et un refus est dit sans quitter l'écran ; l'accord dit ce que GFS ajoute dans la table libre (GFS_Recus, puis GFS_Recus_2) et
// n'écrit rien (Échap) ; une réception déjà là dit qu'elle reprend ; le lien refusé laisse la fenêtre où elle est ; la réponse et son code de contrôle s'affichent ; fermer avant la réponse défait ce qui a été créé, après elle non.
import { createI18n } from '../js/i18n/i18n.js';
import { Run } from './corbeille-firefox.mjs';
import { LONG_DOC, windowMeasure, windowTools } from './fenetre-firefox.mjs';

// Ce que la page montre de la fenêtre : les mesures communes (test/fenetre-firefox.mjs), le champ du code collé et le code de contrôle, les actes que le parcours a notés.
const measure = page => page.run(windowMeasure, '.mod.so', '.rt-body', { field: ['textarea', 'value'], control: ['[data-fk="sr-control"]', 'text'] }, { acts: ['__receiveActs', []] });

function toolsFor(page, tag, found) {
  const run = new Run(page, tag, found, 'recevoir d\'un autre document');
  const snap = () => measure(page);
  const { expect, press, fits } = windowTools(page, run, snap);
  const open = async (kind, flow) => {
    await run.reset();
    await page.run(name => { window.__receive(name); }, flow);
    return expect(kind, 'la fenêtre devait s\'ouvrir sur le code à coller, le clavier dessus, « Continuer » grisé', s => s.modal && s.modal.keys.includes('sr-invite') && s.modal.focus === 'sr-invite' && s.modal.greyed.includes('sr-continue'));
  };
  const paste = async (kind, key, text) => {
    await press(kind, key);
    await page.chord('Control', 'a');
    await page.press(...text.split(''));
  };
  return { run, snap, expect, press, fits, open, paste };
}

// Du code collé à l'accord : « Continuer » grisé tant que rien n'est collé, un refus dit sans quitter l'écran, puis l'accord (`table` : la table qu'il annonce).
async function toAccord(page, tools, t, kind, flow) {
  const first = await tools.open(kind, flow);
  if (!first.modal) return null;
  tools.fits(kind, first, 'le code à coller');
  if (!first.modal.body.includes(t('sr.paste.hint'))) tools.run.note(kind, `la fenêtre devait dire où trouver le code (« ${t('sr.paste.hint')} »)`);
  await tools.press(kind, 'sr-continue');
  if ((await tools.snap()).acts.some(act => act[0] === 'read')) tools.run.note(kind, '« Continuer » grisé ne devait rien demander au parcours');
  await tools.paste(kind, 'sr-invite', 'abc');
  await tools.expect(kind, 'un code saisi devait dégriser « Continuer »', s => s.modal && s.modal.field === 'abc' && !s.modal.greyed.includes('sr-continue'));
  await tools.press(kind, 'sr-continue');
  const refused = await tools.expect(kind, 'un refus devait être dit, sans quitter l\'écran', s => s.modal && s.modal.note === t('so.failed', { message: 'Ce texte n’est pas un code de synchro.' }) && s.modal.keys.includes('sr-invite'));
  tools.fits(kind, refused, 'le refus');
  await tools.paste(kind, 'sr-invite', 'GRISTSYNC2.z');
  await tools.press(kind, 'sr-continue');
  return tools.expect(kind, 'l\'accord devait s\'afficher, le clavier sur « Accepter »', s => s.modal && s.modal.keys.includes('sr-accept') && s.modal.focus === 'sr-accept');
}

// L'accord d'un premier partage : ce que GFS ajoute, dans la table libre ; Échap la ferme sans rien créer.
async function accordFlow(page, tools, t, flow, table) {
  const kind = flow === 'second' ? 'accord d\'un second partage' : 'accord';
  const now = await toAccord(page, tools, t, kind, flow);
  if (!now || !now.modal) return;
  tools.fits(kind, now, 'l\'accord');
  for (const part of [LONG_DOC, t('sr.accord.adds'), table, t('sr.accord.keep')]) if (!now.modal.body.toLowerCase().includes(part.toLowerCase())) tools.run.note(kind, `l'accord devait dire « ${part} » (il dit « ${now.modal.body.slice(0, 200)} »)`);
  if (flow === 'second' && now.modal.body.includes('GFS_Recus ')) tools.run.note(kind, 'l\'accord du second partage ne devait pas annoncer la table du premier');
  for (let i = 0; i < 3; i += 1) { await page.press('Tab'); const inside = await tools.snap(); if (!inside.modal || !inside.modal.inside) tools.run.note(kind, 'Tab devait rester dans la fenêtre'); }
  await page.press('Escape');
  const closed = await tools.expect(kind, 'Échap devait fermer la fenêtre', s => s.modal === null);
  if (closed.acts.some(act => act[0] === 'accept' || act[0] === 'reply')) tools.run.note(kind, 'fermer l\'accord ne devait rien créer');
  if (closed.acts.some(act => act[0] === 'abort' && act[1] === true)) tools.run.note(kind, 'rien n\'avait été répondu');
}

// Une réception déjà là : l'accord dit qu'elle reprend, sans rien recopier.
async function knownFlow(page, tools, t) {
  const kind = 'réception qui reprend';
  const now = await toAccord(page, tools, t, kind, 'connu');
  if (!now || !now.modal) return;
  tools.fits(kind, now, 'l\'accord');
  if (!now.modal.body.includes(t('sr.accord.known', { name: LONG_DOC }))) tools.run.note(kind, `l'accord devait dire que la réception reprend (il dit « ${now.modal.body.slice(0, 200)} »)`);
  if (now.modal.body.toLowerCase().includes(t('sr.accord.adds').toLowerCase())) tools.run.note(kind, 'une réception qui reprend n\'ajoute rien : l\'accord ne devait pas dire ce que GFS ajoute');
  await page.press('Escape');
  await tools.expect(kind, 'Échap devait fermer la fenêtre', s => s.modal === null);
}

// Accepter, le lien du formulaire (un refus, puis le bon), la réponse et son code de contrôle, la fin ; fermer avant la réponse défait, après non.
async function replyFlow(page, tools, t) {
  const kind = 'lien et réponse';
  const accord = await toAccord(page, tools, t, kind, 'ok');
  if (!accord || !accord.modal) return;
  await tools.press(kind, 'sr-accept');
  const link = await tools.expect(kind, 'le lien du formulaire devait se demander, le clavier dessus, « Vérifier le lien » grisé', s => s.modal && s.modal.keys.includes('sr-link') && s.modal.focus === 'sr-link' && s.modal.greyed.includes('sr-check'));
  tools.fits(kind, link, 'le lien du formulaire');
  if (link.modal && !link.modal.body.includes(t('sr.link.hint', { journal: `GFS_Journal_${LONG_DOC.replace(/ /g, '_')}` }))) tools.run.note(kind, `la fenêtre devait dire quelle page ouvrir (il dit « ${link.modal.body.slice(0, 220)} »)`);
  await tools.paste(kind, 'sr-link', 'https://exemple.fr/pas-le-bon');
  await tools.press(kind, 'sr-check');
  const refused = await tools.expect(kind, 'un lien refusé devait être dit, sans quitter l\'écran', s => s.modal && s.modal.note === t('so.failed', { message: 'Ce lien n’écrit pas dans le journal de cette réception.' }) && s.modal.keys.includes('sr-link'));
  tools.fits(kind, refused, 'le lien refusé');
  await tools.paste(kind, 'sr-link', 'https://exemple.fr/o/x/forms/abc/1');
  await tools.press(kind, 'sr-check');
  const reply = await tools.expect(kind, 'la réponse devait s\'afficher avec son code de contrôle, le clavier sur le code', s => s.modal && s.modal.keys.includes('sr-code') && s.modal.control === 'N5H-2AH' && s.modal.focus === 'sr-code');
  tools.fits(kind, reply, 'la réponse');
  if (reply.modal && !reply.modal.body.includes(t('sr.reply.after', { table: 'GFS_Recus' }))) tools.run.note(kind, `la fenêtre devait dire où les fichiers arriveront (« ${t('sr.reply.after', { table: 'GFS_Recus' })} »)`);
  await tools.press(kind, 'sr-copy');
  await tools.expect(kind, 'copier devait dire « copié » ou « sélectionné »', s => s.modal && [t('so.code.copied'), t('so.code.select')].includes(s.modal.note));
  await tools.press(kind, 'so-close');
  const closed = await tools.expect(kind, '« Fermer » devait fermer la fenêtre', s => s.modal === null);
  if (closed.acts.some(act => act[0] === 'abort' && act[1] !== true)) tools.run.note(kind, 'fermer après la réponse ne devait rien défaire');
}

async function abortFlow(page, tools, t) {
  const kind = 'fermer avant la réponse';
  const accord = await toAccord(page, tools, t, kind, 'ok');
  if (!accord || !accord.modal) return;
  await tools.press(kind, 'sr-accept');
  await tools.expect(kind, 'le lien du formulaire devait se demander', s => s.modal && s.modal.keys.includes('sr-link'));
  await tools.press(kind, 'so-cancel');
  const closed = await tools.expect(kind, '« Annuler » devait fermer la fenêtre et défaire ce qui avait été créé', s => s.modal === null && s.acts.some(act => act[0] === 'abort'));
  if (closed.acts.some(act => act[0] === 'abort' && act[1] === true)) tools.run.note(kind, 'rien n\'avait été répondu');
}

// Accepter échoue : la raison est dite, la fenêtre reste sur l'accord.
async function refusalFlow(page, tools, t) {
  const kind = 'accepter refusé';
  const accord = await toAccord(page, tools, t, kind, 'refus');
  if (!accord || !accord.modal) return;
  await tools.press(kind, 'sr-accept');
  const refused = await tools.expect(kind, 'le refus devait être dit, la fenêtre rester sur l\'accord', s => s.modal && s.modal.note === t('so.failed', { message: 'Grist a refusé la création' }) && s.modal.keys.includes('sr-accept'));
  tools.fits(kind, refused, 'le refus');
  await page.press('Escape');
  await tools.expect(kind, 'Échap devait fermer la fenêtre', s => s.modal === null);
}

export async function partagerRecevoirProblems(page, language, tag) {
  const found = [];
  const t = createI18n(language).t;
  const tools = toolsFor(page, tag, found);
  try {
    await accordFlow(page, tools, t, 'ok', 'GFS_Recus');
    await accordFlow(page, tools, t, 'second', 'GFS_Recus_2');
    await knownFlow(page, tools, t);
    await replyFlow(page, tools, t);
    await abortFlow(page, tools, t);
    await refusalFlow(page, tools, t);
  } catch (error) {
    tools.run.note('geste impossible', String(error.message).slice(0, 200));
    await page.press('Escape').catch(() => {});
  }
  await tools.run.reset();
  return found;
}
