// Les repères de la fenêtre « Thème » de GFS que les essais du labo partagent (run-theme.mjs, run-ambiance-kit.mjs), pour la vraie souris. `frame()` rend le cadre de GFS du moment : il change à chaque
// rechargement de la page.
export function themeGestures(frame) {
  const gestures = {
    button: () => frame().locator('.tb-theme'),
    tile: id => frame().locator('.amb', { has: frame().locator(`input[value="${id}"]`) }),
    pickButton: () => frame().locator('.th-win [data-fk="col:pick"]'),
    resetButton: () => frame().locator('.th-win [data-fk="reset"]'),
    // L'explorateur doit être ouvert : le bouton « Thème » y est.
    open: async () => { await gestures.button().click(); await frame().locator('.th-win').waitFor(); },
    close: async () => { await frame().locator('.th-win [data-fk="close"]').click(); await frame().locator('.th-win').waitFor({ state: 'detached' }); },
  };
  return gestures;
}
