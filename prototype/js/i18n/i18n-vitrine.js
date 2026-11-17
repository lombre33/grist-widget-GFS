// Les textes de la vitrine de la fenêtre « Apps et extensions » (décision du porteur, 17/11 : la mosaïque « A · Vitrine »), en français et en anglais dans le
// même lot. Le fichier est à part pour que i18n.js reste sous les 600 lignes de code de l'outil d'audit.

export const VITRINE_STRINGS = Object.freeze({
  fr: {
    'ap.install': 'Installer',
    'ap.remove': 'Retirer',
    'ap.back': 'Apps',
    'ap.details': 'Voir la fiche de {app}',
    'ap.extCount': '{n} {n|extension|extensions}',
    'ap.extActive': '{n} {n|active|actives}',
    'ap.extTitle': 'Extensions',
    'ap.version': 'Version {v}',
    'ap.captions': 'Captures de {app}',
    'ap.shotN': 'Capture {n} sur {total}',
    'ap.noNatives': 'Cette app n’a aucune bibliothèque native que GFS sert : rien à choisir ici.',
    'ap.installFirst': 'Installez l’app pour choisir ses bibliothèques.',
  },
  en: {
    'ap.install': 'Install',
    'ap.remove': 'Remove',
    'ap.back': 'Apps',
    'ap.details': 'See the page of {app}',
    'ap.extCount': '{n} {n|extension|extensions}',
    'ap.extActive': '{n} active',
    'ap.extTitle': 'Extensions',
    'ap.version': 'Version {v}',
    'ap.captions': 'Screenshots of {app}',
    'ap.shotN': 'Screenshot {n} of {total}',
    'ap.noNatives': 'This app has no native library that GFS serves: nothing to choose here.',
    'ap.installFirst': 'Install the app to choose its libraries.',
  },
});
