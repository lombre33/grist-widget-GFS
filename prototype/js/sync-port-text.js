// Les textes que le moteur de partage (kit/js/synchro/) demande à GFS par `port.text(clé, valeurs)` : les siens (kit/js/synchro/textes.js, `error.*` et `recv.*`, repris de Sync+) et ceux que
// le port de GFS ajoute (un échec du cadre d'envoi, une propriété du document que Grist n'a pas dite), en français et en anglais dans le même lot. Une clé inconnue est rendue telle quelle :
// le moteur s'en sert pour reconnaître une erreur prévue (kit/js/synchro/errors.js), et GFS n'écrit alors aucun avertissement.
import { createI18n } from '../kit/js/i18n.js';
import { TEXTES } from '../kit/js/synchro/textes.js';

export const PORT_TEXTES = Object.freeze({
  fr: Object.freeze({
    'error.transfer.frame': 'Le cadre d’envoi de GFS ne répond pas.',
    'error.transfer.token': 'Grist n’a pas donné de jeton d’accès à GFS.',
    'error.transfer.network': 'Le serveur Grist ne répond pas.',
    'error.transfer.timeout': 'Le serveur Grist met trop de temps à répondre.',
    'error.transfer.answer': 'La réponse de Grist n’est pas celle qu’on attend.',
    'error.ownerUnknown': 'Grist n’a pas dit si tu es propriétaire de ce document : réessaie dans un instant.',
  }),
  en: Object.freeze({
    'error.transfer.frame': 'The GFS sending frame is not answering.',
    'error.transfer.token': 'Grist did not give GFS an access token.',
    'error.transfer.network': 'The Grist server is not answering.',
    'error.transfer.timeout': 'The Grist server is taking too long to answer.',
    'error.transfer.answer': 'Grist’s answer is not the expected one.',
    'error.ownerUnknown': 'Grist did not say whether you own this document: try again in a moment.',
  }),
});

// Le texte du moteur dans la langue de GFS à l'instant de l'appel (`language()` rend 'fr' ou 'en' ; la personne peut la changer en route). Une instance du kit par langue : `setLanguage` du kit
// écrirait l'attribut `lang` de la page, que GFS tient lui-même.
export function createEngineText(language) {
  const strings = {};
  for (const source of [TEXTES, PORT_TEXTES]) {
    for (const key of Object.keys(source.fr)) strings[key] = { fr: source.fr[key], en: source.en[key] };
  }
  const instances = {};
  return (key, vars) => {
    if (!Object.hasOwn(strings, key)) return key;
    const lang = language() === 'en' ? 'en' : 'fr';
    instances[lang] ||= createI18n({ strings, language: lang });
    return instances[lang].t(key, vars);
  };
}
