// Le menu « Réglages » de GFS (décision du porteur, 04/11 : les réglages de la suite sous un seul bouton de l'explorateur, la barre flottante ne change pas) :
// la langue (un sous-menu), le thème (sa fenêtre), le bouton « LanguageTool » de la barre (une ligne cochée, contrats 5.2, point 13), la position de la barre
// (un
// sous-menu, le même choix que le dernier bouton de la barre) et « À propos ».
// Aucun DOM ici : le contrôleur dit ce que chaque ligne fait, ce module en fait la liste d'articles de js/ui/menu.js.

import { LANGUAGE_NAMES } from './language.js';

// opts : { t, language() → { choice, grist }, onLanguage(choice), onTheme(), langtool() → { shown, toggle() } (js/shell/correcteurs.js), place() → la ligne
//   « Position de la barre » (js/shell/dock.js), onAbout() }
export function settingsItems({ t, language, onLanguage, onTheme, langtool, place, onAbout }) {
  const { choice, grist } = language();
  const pick = (value, label) => ({ label, check: choice === value, run: () => onLanguage(value) });
  return [
    // « Comme Grist » d'abord, séparé des deux langues, comme dans l'ancien menu du bouton « Langue ».
    { label: t('lang.menu'), icon: 'globe', title: t('lang.tip'), submenu: [pick('auto', t('lang.auto', { name: LANGUAGE_NAMES[grist] })), '-',
      pick('fr', LANGUAGE_NAMES.fr), pick('en', LANGUAGE_NAMES.en)] },
    { label: t('set.theme'), icon: 'palette', title: t('theme.tip'), run: () => onTheme() },
    { label: t('set.langtool'), icon: 'spell', title: t('langtool.tip'), check: langtool().shown, toggle: true, run: () => langtool().toggle() },
    place(),
    '-',
    { label: t('set.about'), icon: 'info', run: () => onAbout() },
  ];
}
