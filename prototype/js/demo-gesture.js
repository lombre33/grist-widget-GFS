// Le bouton « Démo » du mode développement : le parcours des inscriptions posé en un geste, après l'accord de la personne (js/demo.js). Le geste est ici et non dans le contrôleur, qui garde sa
// place pour ses propres gestes ; ce que le contrôleur sait faire, il le prête par `host`.
import { loadDemo, readSchema, planDemo, runDemo, demoSummary, demoReport, DemoError } from './demo.js';

// `host` : { port, doc, t, loader ({ json, text } : lire les fichiers de la démo), blocked() (pourquoi rien ne s'écrit, ou null), ask(opts), notice(text), hideNotice(), installAll(ids), refresh(), consent(on) }.
// `data-demo` dit où le geste en est (« busy », « done », « failed ») : les essais du labo l'attendent. `consent(true)` dit que la personne a déjà donné son accord pour les tables que la démo crée,
// `GFS_Rangement` comprise : pas de seconde question.
export async function demoGesture(host) {
  const { port, t } = host;
  const blocked = host.blocked();
  if (blocked) { host.notice(blocked); return; }
  const say = state => { host.doc.body.dataset.demo = state; };
  try {
    const pack = await loadDemo(host.loader);
    const plan = planDemo(pack, await readSchema(port.doc));
    if (plan.taken.length) { host.notice(t('demo.taken', { tables: plan.taken.join(', ') })); return; }
    const items = demoSummary(pack, plan, t);
    if (!(await host.ask({ title: t('demo.title'), message: t('demo.text'), items, confirmLabel: t('demo.create'), cancelLabel: t('table.cancel') }))) return;
    say('busy');
    host.notice(t('demo.busy'));
    host.consent(true);
    const report = await runDemo({ doc: port.doc, pack, now: new Date(), install: ids => host.installAll(ids), address: host.address() });
    say('done');
    host.hideNotice();
    void host.refresh();
    await host.ask({ title: t('demo.doneTitle'), message: t('demo.doneText'), items: demoReport(report, t), confirmLabel: t('demo.close') });
  } catch (error) {
    say('failed');
    if (error instanceof DemoError && error.code === 'taken') { host.notice(t('demo.taken', { tables: error.detail })); return; }
    console.error('GFS : la démo n’a pas pu être posée', error);
    host.notice(t('demo.failed', { reason: String(error && error.message) }));
  } finally {
    host.consent(false);
  }
}
