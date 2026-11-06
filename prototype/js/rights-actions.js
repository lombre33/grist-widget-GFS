// Les gestes « poser » et « retirer » du panneau « Permissions » (étape 7, lot a ; contrats 11.5) : la question posée à la personne dans une fenêtre du widget (charte : jamais `confirm()`), le
// prix dit avant d'écrire (la première règle coûte l'import et la copie aux éditeurs, 11.4 point 6 ; la page de tout le monde se recharge, 11.5 point 3), puis l'écriture par `RightsWriter`.

const KIND = { shared: 'shared', 'remove-level': 'remove', close: 'close', open: 'open' };

// Les textes de la question pour `kind`, d'après son plan (le plan dit si c'est la première règle du document).
export function askOptions(t, kind, plan) {
  const key = KIND[kind];
  const items = [];
  if (kind === 'close') items.push(t('rights.ask.close.item1'), t('rights.ask.close.item2'));
  if (plan.firstRule) items.push(t('rights.ask.firstRule'));
  return { title: t(`rights.ask.${key}.title`), message: t(`rights.ask.${key}.message`), items, note: t('rights.ask.reload'), confirmLabel: t(`rights.ask.${key}.confirm`), cancelLabel: t('rights.ask.cancel'), safeFirst: true };
}

// Pose le geste `kind` : question, écriture, et compte rendu si Grist ou le plan refuse. Rend true quand Grist a accepté (la page va se recharger). `ask(options)` ouvre la fenêtre (js/ask-window.js).
export async function runAction({ kind, plans, t, ask, writer }) {
  const plan = plans && plans[kind];
  if (!plan || !plan.ok) return false;
  if (!(await ask(askOptions(t, kind, plan)))) return false;
  const result = await writer.apply(kind);
  if (result.ok) return true;
  const message = result.message ? t('rights.ask.failed.message', { message: result.message }) : t('rights.ask.failed.stale');
  await ask({ title: t('rights.ask.failed.title'), message, confirmLabel: t('rights.ask.ok') });
  return false;
}
