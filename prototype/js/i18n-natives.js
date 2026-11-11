// Les textes du choix « CDN ou copie figée » des bibliothèques natives d'une app (demande du porteur, 10/11 ; contrats 2.6, point 14), en français et en
// anglais dans le même lot. Le fichier est à part pour que i18n.js reste sous les 600 lignes de code de l'outil d'audit.

export const NATIVES_STRINGS = Object.freeze({
  fr: {
    'mod.native.title': 'Bibliothèques de l’app',
    'mod.native.mixed': 'mélange',
    'mod.native.detail': 'Choisir fonction par fonction',
    'mod.native.cdn': 'CDN',
    'mod.native.copy': 'Copie figée',
    'mod.native.cdnHint': 'Par défaut. Chargées depuis un CDN, avec leur empreinte vérifiée.',
    'mod.native.copyHint': 'Servies par GFS, sans adresse externe : pour les réseaux fermés.',
    'mod.native.missing': 'Copie indisponible : GFS n’a pas {lib} {version}.',
    'mod.native.missingSome': 'Indisponible : GFS n’a pas toutes les copies (voir le détail).',
    'mod.native.restart': 'La copie est dans l’app : le choix prend effet au prochain démarrage de l’app.',
  },
  en: {
    'mod.native.title': 'App libraries',
    'mod.native.mixed': 'mixed',
    'mod.native.detail': 'Choose function by function',
    'mod.native.cdn': 'CDN',
    'mod.native.copy': 'Frozen copy',
    'mod.native.cdnHint': 'Default. Loaded from a CDN, with their fingerprint checked.',
    'mod.native.copyHint': 'Served by GFS, no external address: for closed networks.',
    'mod.native.missing': 'Copy unavailable: GFS does not have {lib} {version}.',
    'mod.native.missingSome': 'Unavailable: GFS does not have every copy (see the detail).',
    'mod.native.restart': 'The copy is in the app: the choice applies the next time the app starts.',
  },
});
