// Le menu « Réglages » de l'explorateur, à la vraie souris, pour les essais du labo que se partagent run-langue.mjs, run-theme.mjs (par theme-gestes.mjs), run-liste.mjs, run-ouvrir-form.mjs et
// run-langue-publipostage.mjs. Depuis le 04/11 (le porteur : « ok pour la capture 1 ») la langue, le thème, la position de la barre et « À propos » sont ses lignes (et, depuis le 12/11, « Bouton LanguageTool ») : les boutons « Langue » et
// « Thème » de la ligne du titre n'existent plus. Les lignes se désignent par leur rang, pas par leur texte, qui change avec la langue. `target` est le cadre de GFS (ou une autre section de GFS).

export const ROW = Object.freeze({ language: 0, theme: 1, langtool: 2, place: 3, about: 4 });

// Le bouton « Réglages » : le bouton à menu de la ligne du titre qui n'est pas la cloche Notifications.
export const settingsButton = target => target.locator('.ex-title-row .tb:not(.tb-bell)[aria-haspopup="menu"]');

// Les lignes du menu « Réglages » (pas celles d'un sous-menu) et celles du sous-menu ouvert.
export const settingsRows = target => target.locator('.menu:not(.menu-sub) .menu-item');
export const subRows = target => target.locator('.menu-sub .menu-item');

export async function openSettings(target) {
  await settingsButton(target).click();
  await target.locator('.menu:not(.menu-sub)').waitFor();
}

// Ouvre le menu et clique sa ligne `row` (ROW).
export async function clickSettingsRow(target, row) {
  await openSettings(target);
  await settingsRows(target).nth(row).click();
}

// La fenêtre « Thème », par sa ligne « Thème… » (l'explorateur doit être ouvert).
export async function openThemeWindow(target) {
  await clickSettingsRow(target, ROW.theme);
  await target.locator('.th-win').waitFor();
}

// Le sous-menu « Langue » ouvert, à côté de sa ligne : « Comme Grist », un séparateur, Français, English.
export async function openLanguageMenu(target) {
  await clickSettingsRow(target, ROW.language);
  await target.locator('.menu-sub').waitFor();
}

// Choisit une langue : `name` est le texte exact de l'article (« Français », « English »), ou `null` pour « Comme Grist ».
export async function chooseLanguage(target, name = null) {
  await openLanguageMenu(target);
  const rows = subRows(target);
  await (name === null ? rows.first() : rows.filter({ hasText: new RegExp(`^${name}$`) })).click();
}
