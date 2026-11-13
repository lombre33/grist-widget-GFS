// Relais de courrier, variante Google Apps Script : même contrat que relais.mjs, sans serveur à tenir. ÉCRITE, PAS ESSAYÉE (ni ici ni dans un vrai compte Google) :
// à essayer d'abord avec une adresse et un document d'essai. Voir LISEZ-MOI.md, « Variante Google Apps Script ».
//
// Mise en place : script.google.com > Nouveau projet > coller ce fichier > Déployer > Application web (Exécuter en tant que : moi ; Accès : tout le monde) ;
// l'adresse « …/exec » donnée à GFS est suivie de « ?cle=<le secret de GFS> » (Apps Script ne lit pas l'en-tête Authorization).
// Deux essais sans rien d'autre : ouvrir « …/exec?cle=<secret>&essai=<votre adresse> » envoie un message d'essai (vérifie le déploiement, l'autorisation de Google et
// l'envoi) ; un webhook de Grist vers « …/exec?cle=<secret> » sur une table d'essai montre si Grist accepte l'adresse et sa redirection (Exécutions du projet : doPost).
// Limites que ce service impose et que relais.mjs n'a pas : il répond toujours 200 (donc Grist ne retente jamais : un échec est accusé « erreur », et la personne
// renvoie la ligne) ; MailApp : 100 destinataires par jour avec un compte Google gratuit, 1 500 avec Google Workspace (page des quotas d'Apps Script).

const SECRET = 'COLLEZ-ICI-LE-SECRET-DE-GFS';
const ACCUSE_URL = 'COLLEZ-ICI-LE-LIEN-DU-FORMULAIRE-DES-ACCUSES'; // …/api/s/<clé>/tables/GFS_Courrier_Retours/records?flat=1
// Les règles de js/mail/rules.js, recopiées : Apps Script n'importe rien de ce dépôt.
const ADRESSE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;
const COMMANDE = /[\u0000-\u001f\u007f\u2028\u2029]/;
const MAX_DESTINATAIRES = 50;

function liste(champ) {
  const texte = champ == null ? '' : String(champ);
  if (COMMANDE.test(texte)) return null;
  const parts = texte.split(/[,;]/).map(function (part) { return part.trim(); }).filter(Boolean);
  return parts.every(function (part) { return ADRESSE.test(part); }) ? parts : null;
}

function accuser(ligne, etat, detail) {
  UrlFetchApp.fetch(ACCUSE_URL, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify([{ Courrier: ligne.id, Cle: ligne.Cle, Relance: Number(ligne.Relance) || 0, Etat: etat, Detail: String(detail || '').slice(0, 200) }]),
  });
}

function traiter(ligne) {
  const id = ligne.Cle + '.' + ligne.id + '.' + (Number(ligne.Relance) || 0);
  const cache = CacheService.getScriptCache();
  if (cache.get(id)) return 'deja';
  const a = liste(ligne.Destinataires);
  const cc = liste(ligne.Copie);
  const cci = liste(ligne.CopieCachee);
  const entetes = [ligne.Objet, ligne.RepondreA].map(function (valeur) { return valeur == null ? '' : String(valeur); });
  if (!a || !cc || !cci || !a.length || COMMANDE.test(entetes.join('')) || a.length + cc.length + cci.length > MAX_DESTINATAIRES) {
    cache.put(id, '1', 21600);
    accuser(ligne, 'erreur', 'règle');
    return 'erreur';
  }
  try {
    MailApp.sendEmail({ to: a.join(','), cc: cc.join(','), bcc: cci.join(','), subject: entetes[0], body: String(ligne.Corps || ''), htmlBody: ligne.Html ? String(ligne.Html) : undefined, replyTo: entetes[1] || undefined });
  } catch (erreur) {
    accuser(ligne, 'erreur', String(erreur.message || erreur).slice(0, 150));
    return 'erreur';
  }
  cache.put(id, '1', 21600);
  accuser(ligne, 'envoye', 'Google Apps Script');
  return 'envoye';
}

function doPost(e) {
  const reponse = function (objet) { return ContentService.createTextOutput(JSON.stringify(objet)).setMimeType(ContentService.MimeType.JSON); };
  if (!e || !e.parameter || e.parameter.cle !== SECRET) return reponse({ error: 'secret refusé' });
  let lignes;
  try { lignes = JSON.parse(e.postData.contents); } catch (erreur) { return reponse({ error: 'JSON attendu' }); }
  if (!Array.isArray(lignes)) return reponse({ error: 'tableau attendu' });
  return reponse({ results: lignes.filter(function (ligne) { return ligne && typeof ligne.Cle === 'string' && /^[0-9a-f]{16,64}$/.test(ligne.Cle) && Number.isInteger(ligne.id); }).map(function (ligne) { return { id: ligne.id, state: traiter(ligne) }; }) });
}

// Ouvrir l'adresse dans un navigateur : sans « essai », dit que le relais répond ; avec « essai=<adresse> », envoie un message d'essai à cette adresse.
function doGet(e) {
  const reponse = function (objet) { return ContentService.createTextOutput(JSON.stringify(objet)).setMimeType(ContentService.MimeType.JSON); };
  if (!e || !e.parameter || e.parameter.cle !== SECRET) return reponse({ error: 'secret refusé' });
  if (!e.parameter.essai) return reponse({ ok: true, relais: 'répond' });
  const a = liste(e.parameter.essai);
  if (!a || a.length !== 1) return reponse({ error: 'une seule adresse attendue' });
  try {
    MailApp.sendEmail({ to: a[0], subject: 'Essai du relais de courrier', body: 'Ce message prouve que le script envoie depuis votre compte Google.' });
  } catch (erreur) { return reponse({ error: String(erreur.message || erreur).slice(0, 150) }); }
  return reponse({ ok: true, envoye: 'oui' });
}
