// La question d'activation du partage sous Firefox (règle du 03/11 : toute interface ajoute ses mesures à test/interfaces-firefox.test.mjs). Depuis le 18/11 l'activation ferme aussi la structure du document et la question
// le dit (js/rights/rights-actions.js, textes de js/i18n/i18n-share.js) : c'est la plus longue question de GFS (la structure et ses deux conséquences, trois tables d'apps, le rangement, la première règle). Elle tient
// dans la page à 700 px avec ses deux boutons, dit la fermeture de la structure et ce que les éditeurs gardent EN TÊTE de sa liste (la liste défile dans la fenêtre de 700 × 400 : ce qui coûte quelque chose
// se lit sans défiler), met le clavier sur « Annuler » (le choix sûr), et ses deux issues répondent à la vraie souris.
import { createI18n } from '../js/i18n/i18n.js';
import { Run } from './corbeille-firefox.mjs';

// Une ouverture de la question, répondue à la souris par `button` (`ask-yes` : « Activer le partage », `ask-no` : « Annuler »).
async function answerWith(run, t, button, answer) {
  await run.reset();
  await run.page.run(() => window.__askSharing());
  // `fits` rend « dans la page » en tête quand la fenêtre est dans la page mais que sa liste défile (voulu) ; « hors de la page » quand la fenêtre sort.
  const open = await run.expect('la question', 'la fenêtre devait s\'ouvrir avec son titre, dans la page, six lignes', state => state.modal && state.modal.title === t('rights.ask.sharing.title') && !state.modal.fits.includes('hors de la page') && state.modal.items === 6);
  if (open.modal && open.modal.focus !== 'ask-no') run.note('la question', `le clavier devait être sur « ${t('rights.ask.cancel')} », le choix sûr (il est sur « ${open.modal.focus} »)`);
  const text = await run.page.run(() => document.querySelector('.mod.ask') ? document.querySelector('.mod.ask').textContent.replace(/\s+/g, ' ') : '');
  for (const key of ['rights.ask.sharing.structure', 'rights.ask.close.item2']) if (!text.includes(t(key).slice(0, 70))) run.note('la question', `la fenêtre devait dire « ${t(key).slice(0, 70)}… »`);
  if (text.includes(t('rights.ask.sharing.item2'))) run.note('la question', 'la phrase « rien ne change pour les tables de données » devait disparaître : la structure se ferme');
  // Les deux premières lignes (la structure et ses conséquences) se lisent sans défiler : leur bas est dans le corps de la fenêtre, au-dessus des boutons.
  const head = await run.page.run(() => { const body = document.querySelector('.mod.ask .ask-body'); const lines = [...document.querySelectorAll('.mod.ask .ask-items li')].slice(0, 2);
    return body ? { bodyBottom: Math.round(body.getBoundingClientRect().bottom), bottoms: lines.map(line => Math.round(line.getBoundingClientRect().bottom)), top: Math.round(body.scrollTop) } : null; });
  if (!head || head.top !== 0 || head.bottoms.length !== 2 || head.bottoms.some(bottom => bottom > head.bodyBottom)) run.note('la question', `la structure fermée et son prix devaient se lire sans défiler (mesure : ${JSON.stringify(head)})`);
  const buttons = await run.page.run(() => ['ask-yes', 'ask-no'].map(key => { const node = document.querySelector(`[data-fk="${key}"]`); if (!node) return null; const box = node.getBoundingClientRect(); return [key, Math.round(box.bottom), Math.round(box.right), innerHeight, innerWidth]; }));
  for (const found of buttons) if (!found || found[1] > found[3] || found[2] > found[4]) run.note('la question', `le bouton « ${found ? found[0] : '?'} » devait se voir sans défiler (mesure : ${JSON.stringify(found)})`);
  await run.clickSelector(`[data-fk="${button}"]`);
  await run.expect('la question', 'la fenêtre devait se fermer sur le clic', state => state.modal === null);
  const given = await run.page.until(() => window.__sharing, [], 2000).catch(() => null);
  if (given !== answer) run.note('la question', `${button === 'ask-yes' ? '« ' + t('rights.ask.sharing.confirm') + ' »' : '« ' + t('rights.ask.cancel') + ' »'} devait répondre « ${answer} » (réponse : ${given})`);
}

// Les mesures de la question d'activation, dans la langue de la page (`language`) ; rend les écarts { kind, text }.
export async function activationProblems(page, language, tag) {
  const found = [];
  const t = createI18n(language).t;
  const run = new Run(page, tag, found, 'activer le partage');
  for (const [button, answer] of [['ask-yes', 'yes'], ['ask-no', 'no']]) {
    try {
      await answerWith(run, t, button, answer);
    } catch (error) {
      run.note('geste impossible', `${button} : ${String(error.message).slice(0, 200)}`);
      await page.press('Escape').catch(() => {});
    }
    await run.reset();
  }
  return found;
}
