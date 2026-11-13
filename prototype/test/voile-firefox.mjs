// Le voile des fenêtres sous Firefox (décision du porteur du 09/11, charte « un clic sur le voile ne ferme rien » : seuls « Annuler », « Fermer » et Échap ferment). Chaque fenêtre bâtie sur la base commune
// (js/ui/modal.js), et les deux qui ont la leur (« Apps et extensions », « Table de travail »), s'ouvre, la vraie souris clique sur le voile à côté d'elle (un point qui est bien sur le voile : l'essai le vérifie, sinon il ne mesurerait rien), la fenêtre reste ouverte, puis Échap la ferme.
// Avant le 09/11, `modal.js`, `modules-window.js` et `work-window.js` fermaient la fenêtre au premier appui sur le voile (« Ce nom est déjà pris » comptait même ce clic comme un « Annuler »).

const WINDOWS = [
  { name: '« Ce nom est déjà pris »', open: () => { window.__askConflict({ app: 'Publipostage+', repeat: true }); } },
  { name: '« À propos »', open: () => { window.__about(); } },
  { name: '« Partager »', open: () => { window.__share('actif'); } },
  { name: '« Gérer les partages »', open: () => { window.__manage(); } },
  { name: '« Apps et extensions »', open: () => { window.__modulesWindow(); } },
  { name: '« Table de travail »', open: () => { window.__workWindow(); } },
];

// La fenêtre du dessus, et un point du voile à côté d'elle (le premier des quatre côtés qui laisse 8 px au moins).
function veil() {
  const scrims = document.querySelectorAll('.mod-scrim');
  const scrim = scrims[scrims.length - 1];
  if (!scrim) return null;
  const box = scrim.firstElementChild.getBoundingClientRect();
  const [width, height] = [document.documentElement.clientWidth, document.documentElement.clientHeight];
  const gaps = [box.left, width - box.right, box.top, height - box.bottom];
  const spots = [[box.left / 2, height / 2], [(box.right + width) / 2, height / 2], [width / 2, box.top / 2], [width / 2, (box.bottom + height) / 2]];
  const at = gaps.findIndex(gap => gap >= 8);
  const spot = at < 0 ? null : spots[at].map(Math.round);
  const hit = spot ? document.elementFromPoint(spot[0], spot[1]) : null;
  return { count: scrims.length, spot, onScrim: Boolean(hit && hit.classList.contains('mod-scrim')) };
}

export async function voileProblems(page, tag) {
  const found = [];
  for (const win of WINDOWS) {
    const note = (kind, text) => found.push({ kind: `voile des fenêtres : ${kind}`, text: `${tag}, ${win.name} : ${text}` });
    await page.run(win.open);
    const before = await page.until(veil).catch(() => null);
    if (!before) { note('fenêtre absente', 'la fenêtre ne s\'ouvre pas'); continue; }
    if (before.spot) {
      if (!before.onScrim) note('point hors du voile', `le point (${before.spot.join(', ')}) n'est pas sur le voile`);
      await page.click(...before.spot);
      await page.run(() => new Promise(resolve => setTimeout(resolve, 150)));
      const after = await page.run(veil);
      if (!after || after.count !== before.count) note('un clic sur le voile ferme la fenêtre', `le clic en (${before.spot.join(', ')}) l'a fermée`);
    }
    await page.press('Escape');
    await page.until(() => !document.querySelector('.mod-scrim'), [], 2000).catch(() => note('Échap', 'Échap ne ferme pas la fenêtre'));
  }
  return found;
}
