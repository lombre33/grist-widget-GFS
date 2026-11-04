// Les repères de la fenêtre « Thème » de GFS que les essais du labo partagent (run-theme.mjs, run-ambiance-kit.mjs), pour la vraie souris. `frame()` rend le cadre de GFS du moment : il change à chaque
// rechargement de la page.
import { openThemeWindow, settingsButton } from './reglages-gestes.mjs';

export function themeGestures(frame) {
  const gestures = {
    // Depuis le 04/11 la fenêtre s'ouvre par la ligne « Thème… » du menu « Réglages » : `button` est ce bouton « Réglages ».
    button: () => settingsButton(frame()),
    tile: id => frame().locator('.amb', { has: frame().locator(`input[value="${id}"]`) }),
    pickButton: () => frame().locator('.th-win [data-fk="col:pick"]'),
    resetButton: () => frame().locator('.th-win [data-fk="reset"]'),
    // L'explorateur doit être ouvert : le bouton « Réglages » y est.
    open: () => openThemeWindow(frame()),
    close: async () => { await frame().locator('.th-win [data-fk="close"]').click(); await frame().locator('.th-win').waitFor({ state: 'detached' }); },
  };
  return gestures;
}
