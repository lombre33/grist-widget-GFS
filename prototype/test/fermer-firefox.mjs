// La question de « fermer » sous Firefox (règle du 03/11 : toute nouvelle interface ajoute ses mesures à test/interfaces-firefox.test.mjs). Quand l'app active ne répond pas à `fermer`, ou répond par une
// erreur, GFS pose une question dans la fenêtre d'accord du widget (js/ask-window.js, textes de js/leave.js) : elle nomme l'app, tient dans la page à 700 px avec ses deux boutons, met le clavier sur le choix sûr
// (« Attendre » ou « Rester », jamais « Fermer quand même »), et ses deux issues répondent à la vraie souris. Le plus long nom d'app (« Publipostage+ ») et la plus longue phrase d'app (cent vingt signes,
// la limite de GFS) sont ceux de l'essai. Entrée et Espace sur un bouton ne se jouent pas dans ce Firefox sans écran (voir test/interfaces-firefox.test.mjs) : les issues se jouent à la souris.
import { createI18n } from '../js/i18n.js';
import { Run } from './corbeille-firefox.mjs';

const APP = 'Publipostage+';
const LONGEST = 'Enregistrement refusé par Grist : la table « Publipostage_Fichiers » est protégée par une règle d’accès, aucune ligne ne peut y être ajoutée ni modifiée'.slice(0, 120);

// Une fenêtre de la question : `reason` nul (l'app se tait) ou la phrase de l'app (elle a répondu par une erreur) ; le clavier est sur `safe`, la souris sur « Fermer quand même » puis sur le choix sûr.
async function question(run, t, { reason, title, safe }) {
  const kind = reason === null ? 'l\'app se tait' : 'l\'app répond par une erreur';
  for (const [button, answer] of [['ask-yes', 'force'], ['ask-no', 'stay']]) {
    await run.reset();
    await run.page.run(text => window.__askLeave(text), reason);
    const open = await run.expect(kind, 'la fenêtre devait s\'ouvrir avec le nom de l\'app dans son titre et tenir dans la page (état : fits)', state => state.modal && state.modal.title === title && state.modal.fits.length === 0);
    if (open.modal && open.modal.focus !== 'ask-no') run.note(kind, `le clavier devait être sur « ${safe} », le choix sûr (il est sur « ${open.modal.focus} »)`);
    await run.clickSelector(`[data-fk="${button}"]`);
    await run.expect(kind, 'la fenêtre devait se fermer sur le clic', state => state.modal === null);
    const given = await run.page.until(() => window.__leave, [], 2000).catch(() => null);
    if (given !== answer) run.note(kind, `${button === 'ask-yes' ? '« ' + t('gfs.leave.force') + ' »' : '« ' + safe + ' »'} devait répondre « ${answer} » (réponse : ${given})`);
  }
}

async function silent(run, t) {
  await question(run, t, { reason: null, title: t('gfs.leave.silentTitle', { app: APP }), safe: t('gfs.leave.wait') });
}

async function failed(run, t) {
  await question(run, t, { reason: LONGEST, title: t('gfs.leave.faultTitle', { app: APP }), safe: t('gfs.leave.stay') });
}

// Les mesures de la question de « fermer », dans la langue de la page (`language`) ; rend les écarts { kind, text }.
export async function fermerProblems(page, language, tag) {
  const found = [];
  const t = createI18n(language).t;
  const run = new Run(page, tag, found, 'changer d\'app');
  for (const step of [silent, failed]) {
    try {
      await step(run, t);
    } catch (error) {
      run.note('geste impossible', `${step.name} : ${String(error.message).slice(0, 200)}`);
      await page.press('Escape').catch(() => {});
    }
    await run.reset();
  }
  return found;
}
