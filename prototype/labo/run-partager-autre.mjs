// « Partager > Dans un autre document Grist » : l'onglet, la fenêtre d'envoi (js/share-other-window.js) et « Gérer les partages > Autres documents », joués dans GFS lui-même, dans un VRAI Grist (`GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash vrai-serveur.sh`),
// à 700 × 400, à la vraie souris, deux documents qui ont GFS. Le premier est celui de la personne : tout passe par les fenêtres de GFS. Le second est piloté par l'essai avec les fonctions du moteur (le côté
// qui reçoit n'a pas encore d'écran dans GFS) : il lit l'invitation, crée sa réception, répond.
//   1. « Partager… » d'un PDF : l'onglet « Dans un autre document Grist » est là, son bouton « Relier un nouveau document… » dégrisé (propriétaire), même sans que les droits de GFS soient activés ; rien n'est écrit avant l'accord ;
//   2. l'accord dit ce qui est ajouté ; « Continuer » crée l'export et rend un code ; la réponse collée est contrôlée (le document dit par Grist, le même code de contrôle des deux côtés) ;
//   3. « Envoyer » : le fichier arrive dans l'autre document avec les mêmes octets, le partage s'arrête (plus de table technique ni de webhook) ;
//   4. annuler après le code défait ce qui était préparé ; Échap sur l'accord n'écrit rien ;
//   5. « Une copie qui se met à jour » : le lien reste après le premier envoi ; un second PDF part par le menu des niveaux, sans nouveau code ; « Arrêter la copie » le sort du partage (la copie reste chez l'autre, en
//      archive) ; « Gérer les partages > Autres documents » arrête le lien (plus de webhook ni de table technique chez l'envoyeur).
// LAB_LANG=fr|en, LAB_SCHEME=light|dark.
import { createServer } from 'node:http';
import { serve } from './lab-server.mjs';
import { chromium, say, check } from './lab-common.mjs';
import { openConnectIn, requireServer, newContext } from './lab-serveur.mjs';
import { createI18n } from '../js/i18n.js';
import { PAGE_PORT, openGfs, importSamples, openRowMenu, contrastProblems, shot as pdfShot } from './lab-pdf.mjs';
import { fits } from './lab-droits.mjs';
import { startEngine, formLink } from './lab-partage.mjs';

const lang = process.env.LAB_LANG || 'fr';
const scheme = process.env.LAB_SCHEME || 'light';
const { t } = createI18n(lang);
const shot = (frame, name) => pdfShot(frame, `autre-${lang}-${scheme}-${name}`);
const unexpected = run => run.problems.filter(problem => !run.allow.some(known => known.test(problem)));
const text = async (frame, selector) => (await frame.locator(selector).innerText()).replace(/\s+/g, ' ');

async function openShare(frame, name) {
  await openRowMenu(frame, name);
  await frame.getByRole('menuitem', { name: new RegExp(`^${t('share.menu')}`) }).click();
  await frame.locator('.mod.sh .rt-content').waitFor();
}
// Le bouton « Relier un nouveau document… » de l'onglet « Dans un autre document Grist » (la fenêtre « Partager » étant ouverte).
const otherLine = async frame => {
  await frame.locator('[data-fk="share-tab-other"]').click();
  const button = frame.locator('[data-fk="other-new"]');
  await button.waitFor();
  return button;
};
const docName = ({ page, docId }) => page.evaluate(async id => (await (await fetch(`/api/docs/${id}`)).json()).name, docId);
const webhooks = ({ page, docId }) => page.evaluate(async id => (await (await fetch(`/api/docs/${id}/webhooks`)).json()).webhooks.length, docId);
const closeAll = async (page, frame) => { await page.keyboard.press('Escape'); await frame.locator('.mod-scrim').first().waitFor({ state: 'detached' }).catch(() => {}); };

const pluginApi = await requireServer();
const pages = createServer(serve(process.env.REPO_DIR, undefined, openConnectIn(/prototype[/\\]transfer[/\\]index\.html$/))).listen(PAGE_PORT, '127.0.0.1');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
try {
  const context = await newContext(browser, pluginApi, { colorScheme: scheme });
  const source = await openGfs(context, { lang });
  const { page, frame } = source;
  await importSamples(source);
  const target = await openGfs(context, { lang });
  await startEngine(target.frame);

  say('--- 1. la ligne est là, rien n\'est écrit avant l\'accord ---');
  const loaded = await frame.evaluate(() => performance.getEntriesByType('resource').map(entry => entry.name).filter(name => /\/kit\/js\/synchro\//.test(name)).length);
  check('un document sans partage ne charge pas le moteur', loaded === 0, loaded);
  await openShare(frame, 'Facture.pdf');
  const line = await otherLine(frame);
  check('l\'onglet « Dans un autre document Grist » est dans la fenêtre « Partager », son bouton dégrisé pour le propriétaire, sans document relié encore', (await line.count()) === 1 && (await line.getAttribute('aria-disabled')) === null && (await frame.locator('.mod.sh .rr[data-link]').count()) === 0, await text(frame, '.mod.sh'));
  await shot(frame, '1-partager');
  await line.click();
  await frame.locator('.mod.so [data-fk="so-continue"]').waitFor();
  const before = await source.rest.tables();
  check('l\'accord dit ce que GFS ajoute, avec les vrais noms', (await text(frame, '.mod.so')).includes('GFS_Synchro') && (await text(frame, '.mod.so')).includes('id_sync'), await text(frame, '.mod.so'));
  check('rien n\'est encore écrit dans le document (ni table technique, ni colonnes d\'aide)', !before.includes('GFS_Synchro') && !(await source.rest.columns('GFS_Fichiers')).some(each => each.id === 'id_sync'), before);
  check('la fenêtre tient dans le panneau, boutons visibles, contraste de 4,5:1', await fits(frame, '.mod.so'), await contrastProblems(frame, '.mod.so'));
  await shot(frame, '2-accord');
  await page.keyboard.press('Escape');
  await frame.locator('.mod.so').waitFor({ state: 'detached' });
  check('Échap sur l\'accord n\'écrit rien', !(await source.rest.tables()).includes('GFS_Synchro'), await source.rest.tables());
  await closeAll(page, frame);

  say('--- 2. accord, code, réponse contrôlée ---');
  await openShare(frame, 'Facture.pdf');
  await (await otherLine(frame)).click();
  // « Exiger la comparaison du code » : coché au départ (décision du 09/11) ; LAB_STRICT=0 le décoche, pour mesurer l'autre chemin.
  const strict = process.env.LAB_STRICT !== '0';
  check('« exiger le code » est proposé et coché au départ', await frame.locator('[data-fk="so-strict"]').isChecked(), await text(frame, '.mod.so'));
  if (!strict) await frame.locator('[data-fk="so-strict"]').click();
  await frame.locator('[data-fk="so-continue"]').click();
  await frame.locator('[data-fk="so-code"]').waitFor();
  const code = await frame.locator('[data-fk="so-code"]').inputValue();
  check('un code d\'invitation est affiché, et GFS a posé la table technique et les colonnes d\'aide', /^GRISTSYNC2\./.test(code) && (await source.rest.tables()).includes('GFS_Synchro') && (await source.rest.columns('GFS_Fichiers')).some(each => each.id === 'id_sync'), code.slice(0, 20));
  check('la fenêtre du code tient dans le panneau', await fits(frame, '.mod.so'), await contrastProblems(frame, '.mod.so'));
  await shot(frame, '3-code');
  check('« Contrôler » est grisé tant que rien n\'est collé', (await frame.locator('[data-fk="so-check"]').getAttribute('aria-disabled')) === 'true');

  const invitation = await target.frame.evaluate(text => window.__try(() => window.__s.readInvitation(text)), code);
  check('l\'autre document lit l\'invitation', invitation.ok && invitation.value.name === 'Facture', invitation);
  const made = await target.frame.evaluate(invite => window.__try(async () => {
    const plans = invite.tables.map(tb => ({ tb, dest: 'GFS_Recus' }));
    const reception = await window.__s.createReception(invite, plans, { reserve: true, options: { archive: true } });
    return { journal: reception.journal, note: reception.note };
  }), invitation.value);
  check('l\'autre document crée sa réception', made.ok && made.value.journal === 'GFS_Journal_Facture', made);
  const { link } = await formLink(target);
  const replied = await target.frame.evaluate(args => window.__try(() => window.__s.receptionReply(args.made, args.link)), { made: made.value, link });
  check('l\'autre document répond (lien collé contrôlé)', replied.ok && /^GRISTSYNC2\./.test(replied.value.code), replied);

  const reply = frame.locator('[data-fk="so-reply"]');
  await reply.click();
  await page.keyboard.insertText('GRISTSYNC2.pasuneréponse');
  await frame.locator('[data-fk="so-check"]').click();
  await frame.waitForFunction(() => /./.test(document.querySelector('.mod.so .mod-note').textContent) && document.querySelector('[data-fk="so-reply"]'), null, { timeout: 15000 });
  check('une réponse qui n\'en est pas une est refusée, dite par le moteur, la fenêtre reste où elle est', (await frame.locator('[data-fk="so-reply"]').count()) === 1 && /./.test(await text(frame, '.mod.so .mod-note')), await text(frame, '.mod.so .mod-note'));
  await reply.fill('');
  await reply.click();
  await page.keyboard.insertText(replied.value.code);
  await frame.locator('[data-fk="so-check"]').click();
  await frame.locator('[data-fk="so-control"]').waitFor({ timeout: 20000 });
  const shown = await text(frame, '.mod.so');
  check('le document qui répond est dit par Grist, avec le même code de contrôle que chez l\'autre', shown.includes(await docName(target)) && (await frame.locator('[data-fk="so-control"]').innerText()) === replied.value.control, shown);
  check('la fenêtre de contrôle tient dans le panneau', await fits(frame, '.mod.so'), await contrastProblems(frame, '.mod.so'));
  await shot(frame, '4-controle');

  say('--- 3. envoi ---');
  if (strict) {
    // Le moteur est en sécurité renforcée : sans la case, « Envoyer » est grisé et muet ; avec elle, il part.
    check('exigé : la case « j\'ai comparé » est là, « Envoyer » grisé', (await frame.locator('[data-fk="so-compared"]').count()) === 1 && (await frame.locator('[data-fk="so-send"]').getAttribute('aria-disabled')) === 'true', await text(frame, '.mod.so'));
    await frame.locator('[data-fk="so-send"]').click({ force: true }); // grisé : Playwright refuse un clic normal, `force` le donne quand même (c'est ce que fait une vraie souris)
    await page.waitForTimeout(1500);
    check('exigé : un clic sur « Envoyer » grisé n\'envoie rien (aucun webhook, la fenêtre reste)', (await webhooks(source)) === 0 && (await frame.locator('[data-fk="so-control"]').count()) === 1);
    await frame.locator('[data-fk="so-compared"]').click();
  } else {
    check('non exigé : pas de case, « Envoyer » dégrisé', (await frame.locator('[data-fk="so-compared"]').count()) === 0 && (await frame.locator('[data-fk="so-send"]').getAttribute('aria-disabled')) !== 'true');
  }
  await frame.locator('[data-fk="so-send"]').click();
  const waitDone = async () => { for (let i = 0; i < 120; i++) { if ((await text(frame, '.mod.so')).includes(t('so.done.hint'))) return true; await page.waitForTimeout(1000); } return false; };
  check('la fenêtre dit que le fichier est arrivé et que le partage est arrêté', await waitDone(), await text(frame, '.mod.so'));
  await shot(frame, '5-fini');
  check('plus de table technique ni de webhook chez l\'envoyeur ; les colonnes d\'aide restent', !(await source.rest.tables()).includes('GFS_Synchro') && (await webhooks(source)) === 0, await source.rest.tables());
  // La réception reprend d'elle-même : la page de l'autre document est fermée, puis rouverte par la personne ; GFS y voit le journal reçu et relance la boucle du moteur (js/sync-resume.js) : le contenu du PDF
  // arrive sans que l'essai fasse rien.
  const targetPath = target.path;
  await target.page.close();
  const back = await openGfs(context, { lang, path: targetPath });
  let rows = [];
  for (let i = 0; i < 90 && !rows.some(row => row.Nom === 'Facture.pdf' && row.Contenu); i++) {
    rows = await back.rest.rows('GFS_Recus');
    if (!rows.some(row => row.Contenu)) await page.waitForTimeout(1000);
  }
  const sent = (await source.rest.rows('GFS_Fichiers')).find(row => row.Identifiant === source.id);
  const was = await source.rest.attachment(sent.Contenu[1]);
  const now = rows[0] && rows[0].Contenu ? await back.rest.attachment(rows[0].Contenu[1]) : null;
  check('le fichier est dans l\'autre document, mêmes octets, et lui seul', rows.length === 1 && Boolean(now) && now.hash === was.hash && now.size === was.size, { rows: rows.map(row => row.Nom), was, now });
  check('GFS a relancé la réception à l\'ouverture de la page (sans rien lui demander)', Boolean(now), { rows });
  await frame.locator('[data-fk="so-close"]').click();
  await frame.locator('.mod.so').waitFor({ state: 'detached' });
  await closeAll(page, frame);

  say('--- 4. annuler après le code défait ce qui était préparé ---');
  await openShare(frame, 'Devis.pdf');
  await (await otherLine(frame)).click();
  await frame.locator('[data-fk="so-continue"]').click();
  await frame.locator('[data-fk="so-code"]').waitFor();
  check('le second code est prêt, la table technique est revenue', (await source.rest.tables()).includes('GFS_Synchro'));
  await frame.locator('[data-fk="so-cancel"]').click();
  await frame.locator('.mod.so').waitFor({ state: 'detached' });
  let gone = false;
  for (let i = 0; i < 20 && !gone; i++) { gone = !(await source.rest.tables()).includes('GFS_Synchro'); if (!gone) await page.waitForTimeout(500); }
  check('« Annuler » défait l\'export préparé (plus de table technique)', gone, await source.rest.tables());
  check('les deux PDF de l\'envoyeur sont intacts', (await source.rest.rows('GFS_Fichiers')).map(row => row.Nom).sort().join() === 'Devis.pdf,Facture.pdf');
  await closeAll(page, frame);
  check('aucune erreur de GFS dans la console', unexpected(source).length === 0 && unexpected(back).length === 0, [...unexpected(source), ...unexpected(back)]);
} finally {
  await browser.close();
  pages.close();
}
