// Le contexte que GFS rend à une app (contrats 5.2) : un objet construit d'après ce que le contrôleur sait. Du code sans effet de bord.
// Le contexte est demandé par l'appel `contexte`, dès le démarrage de l'app : il ne dépend ni de sa page ni de son adresse (5.2, point 1).

import { CONTRACT } from './manifest.js';

export const HOST = Object.freeze({ nom: 'Grist Factory Suite', version: '0.2.0-proto' });

// L'instance de Grist : l'origine de la page qui porte GFS (le référent de son cadre). Provisoire : le kit la calculera (cahier 5.6, la
// correction de l'adresse de base de Publipostage+, qui sait aussi les instances sous un préfixe), à l'étape 3.
export function instanceOf(referrer) {
  try { return referrer ? new URL(referrer).origin : null; } catch (error) { return null; }
}

// La page de Grist, au mieux : `/p/<numéro>` dans l'adresse de la page qui porte GFS (5.2 : « au mieux »).
export function pageOf(referrer) {
  try {
    const found = referrer ? /\/p\/(\d+)(?:\/|$)/.exec(new URL(referrer).pathname) : null;
    return found ? Number(found[1]) : null;
  } catch (error) { return null; }
}

// L'identité que GFS donne à une app (contrats 5.2, point 9) : l'adresse e-mail de la personne, `{ email }`, seulement à l'app qui l'a déclarée (`permissions.identite`, 3.4, point 6) et quand GFS la
// connaît (6.4, point 6) ; `null` dans tous les autres cas, sans que l'app puisse distinguer « pas déclarée » de « GFS ne la connaît pas ». `address` : celle que GFS a apprise, '' tant qu'il l'ignore.
export function identityFor(policy, address) {
  const email = typeof address === 'string' ? address.trim() : '';
  return policy && policy.identite && email ? { email } : null;
}

// `facts` : ce que le contrôleur a lu (instance, page, document, adresse du widget), `session` : { access, extensions, libraries, opening, storage, bar, identity, ambiance }.
export function buildContext(facts, session, params) {
  const { preferences, readonly } = params;
  return {
    contrat: CONTRACT,
    hote: HOST,
    instance: facts.instance,
    document: facts.document,
    page: facts.page,
    section: null, // Grist ne le dit pas au widget (5.2)
    adresseWidget: facts.widgetAddress,
    langue: preferences.language || null,
    culture: preferences.culture || null,
    fuseau: preferences.timeZone || null,
    devise: preferences.currency || null,
    lectureSeule: Boolean(readonly),
    acces: session.access,
    extensions: session.extensions,
    bibliotheques: session.libraries,
    ouverture: session.opening || null,
    stockage: session.storage || {}, // la copie de l'espace de CETTE app dans le navigateur de GFS (5.3)
    barre: session.bar || null, // la barre de GFS qui recouvre le cadre : { bord, epaisseur, zone }, ou `null` quand rien ne le recouvre (5.2, point 7)
    identite: session.identity || null, // l'adresse e-mail de la personne, `{ email }`, pour l'app qui l'a déclarée et quand GFS la connaît (5.2, point 9)
    ambiance: session.ambiance || null, // l'ambiance et la couleur que la personne a choisies pour GFS et ses apps (js/theme.js), ou `null` : l'app garde ses couleurs (5.2, point 10)
  };
}
