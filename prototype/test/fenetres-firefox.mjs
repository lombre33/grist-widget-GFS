// Les largeurs et les coins des fenêtres sous Firefox (décision du porteur du 09/11, charte section 1 : « trois largeurs » de 400 px (question, saisie), 480 px (formulaire) et grande (liste ou tableau, 960 px plafonnés au panneau),
// et 8 px de rayon sur le cadre). Chaque fenêtre s'ouvre par son crochet de la page d'essai ; l'essai mesure ce que Firefox calcule : la largeur de la fenêtre (le jeton, plafonné à la place que le voile lui laisse) et le rayon
// de son cadre. Avant le 09/11, GFS en avait six (420, 480, 560, 620, 640) et des coins de 10 px.

const WIDTHS = { question: 400, form: 480, large: 960 };
const WINDOWS = [
  { name: '« Ce nom est déjà pris »', kind: 'question', open: () => { window.__askConflict({ app: 'Publipostage+', repeat: true }); } },
  { name: '« À propos »', kind: 'question', open: () => { window.__about(); } },
  { name: '« Partager »', kind: 'large', open: () => { window.__share('actif'); } },
  { name: '« Gérer les partages »', kind: 'large', open: () => { window.__manage(); } },
  { name: '« Envoyer à un autre document »', kind: 'form', open: () => { window.__sendOther('ok'); } },
  { name: '« Poids du document »', kind: 'large', open: () => { window.__weight({ bytes: 18000000, files: 12 }); } },
  { name: '« Apps et extensions »', kind: 'large', open: () => { window.__modulesWindow(); } },
  { name: '« Table de travail »', kind: 'form', open: () => { window.__workWindow(); } },
];

// La fenêtre du dessus : sa largeur, la place que le voile lui laisse (sa largeur moins ses marges), le rayon de son cadre.
function measure() {
  const scrims = document.querySelectorAll('.mod-scrim');
  const scrim = scrims[scrims.length - 1];
  if (!scrim) return null;
  const win = scrim.firstElementChild;
  const style = getComputedStyle(scrim);
  return {
    width: Math.round(win.getBoundingClientRect().width * 10) / 10,
    room: scrim.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
    radius: getComputedStyle(win).borderTopLeftRadius,
  };
}

export async function fenetresProblems(page, tag) {
  const found = [];
  for (const win of WINDOWS) {
    const note = (kind, text) => found.push({ kind: `largeurs et coins des fenêtres : ${kind}`, text: `${tag}, ${win.name} : ${text}` });
    await page.run(win.open);
    const shown = await page.until(measure).catch(() => null);
    if (!shown) { note('fenêtre absente', 'la fenêtre ne s\'ouvre pas'); continue; }
    const wanted = Math.min(WIDTHS[win.kind], shown.room);
    if (Math.abs(shown.width - wanted) > 1) note('largeur', `la fenêtre mesure ${shown.width} px au lieu de ${wanted} px (${win.kind} : ${WIDTHS[win.kind]} px plafonnés à la place de ${shown.room} px)`);
    if (shown.radius !== '8px') note('coins', `le cadre a un rayon de ${shown.radius} au lieu de 8px`);
    await page.press('Escape');
    await page.until(() => !document.querySelector('.mod-scrim'), [], 2000).catch(async () => { await page.press('Escape'); });
  }
  return found;
}
