// Le menu « Réglages » de GFS (décision du porteur, 04/11 : les réglages de la suite sous un seul bouton de l'explorateur, la barre flottante ne change pas) :
// la langue (un sous-menu), le thème (sa fenêtre), « Gérer les partages… » (12/11, choix du porteur : une porte directe, sans passer par « Partager… » d'un
// fichier), « Dépendances… » (18/11 : les bibliothèques que GFS sert, en lecture),
// les « Réglages avancés » (un sous-menu, où est le bouton « LanguageTool » de la barre, contrats 5.2, point
// 13 :
// le porteur, 12/11, « c'est beaucoup trop niche pour être au même niveau que les autres réglages »), la position de la barre (un sous-menu, le même choix que
// le
// dernier bouton de la barre) et « À propos ».
// Aucun DOM ici : le contrôleur dit ce que chaque ligne fait, ce module en fait la liste d'articles de js/ui/menu.js.

import { LANGUAGE_NAMES } from './language.js';

// opts : { t, language() → { choice, grist }, onLanguage(choice), onTheme(), langtool() → { shown, toggle() } (js/shell/correcteurs.js), place() → la ligne
//   « Position de la barre » (js/shell/dock.js), onAbout(), onDependencies(), manage() → { why (la raison pour laquelle « Gérer les partages… » est grisé, ou
//   null), open(),
//   notice(texte) }, index() → la même chose pour « Index des noms… » (js/rights/index-control.js) }
export function settingsItems({ t, language, onLanguage, onTheme, langtool, place, onAbout, onDependencies, manage, index }) {
  const { choice, grist } = language();
  const pick = (value, label) => ({ label, check: choice === value, run: () => onLanguage(value) });
  const sharing = manage();
  const names = index();
  return [
    // « Comme Grist » d'abord, séparé des deux langues, comme dans l'ancien menu du bouton « Langue ».
    { label: t('lang.menu'), icon: 'globe', title: t('lang.tip'), submenu: [pick('auto', t('lang.auto', { name: LANGUAGE_NAMES[grist] })), '-',
      pick('fr', LANGUAGE_NAMES.fr), pick('en', LANGUAGE_NAMES.en)] },
    { label: t('set.theme'), icon: 'palette', title: t('theme.tip'), run: () => onTheme() },
    // Grisé avec sa raison, jamais caché : un clic la dit. Le propriétaire est vérifié par la fenêtre elle-même (qui dit à qui s'adresser).
    { label: t('manage.open'), icon: 'users', title: sharing.why || t('manage.open.hint'), greyed: Boolean(sharing.why),
      run: () => (sharing.why ? sharing.notice(sharing.why) : sharing.open()) },
    // L'index des noms (26/11, choix du porteur) : un geste de propriétaire, grisé avec sa raison comme le précédent ; il dit à qui s'adresser quand on ne
    // l'est pas.
    { label: t('set.index'), icon: 'table', title: names.why || t('set.index.tip'), greyed: Boolean(names.why),
      run: () => (names.why ? names.notice(names.why) : names.open()) },
    // La fenêtre en lecture seule des bibliothèques que GFS sert : versions, avis de sécurité, licences (js/apps/dependencies-window.js).
    { label: t('dep.menu'), icon: 'package', title: t('dep.menu.tip'), run: () => onDependencies() },
    // Les réglages qu'on touche rarement vont ici, un par ligne : « more » (plus d'articles), l'icône des « Plus d'actions » de l'explorateur, dit la même
    // chose.
    { label: t('set.advanced'), icon: 'more', title: t('set.advanced.tip'), submenu: [
      { label: t('set.langtool'), icon: 'spell', title: t('langtool.tip'), check: langtool().shown, toggle: true, run: () => langtool().toggle() },
    ] },
    place(),
    '-',
    { label: t('set.about'), icon: 'info', run: () => onAbout() },
  ];
}
