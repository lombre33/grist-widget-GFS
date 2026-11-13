# Relais de courrier

Envoyer des e-mails depuis un document Grist **sans que personne ouvre le document** : une application dépose un message dans une table du document (la
boîte d'envoi), Grist appelle ce relais par un webhook, le relais envoie le message par le serveur de messagerie et rend son accusé au document.

État : **essai** (13/11/2026), sans écran dans GFS. Mesuré dans un vrai Grist 1.7.19 avec un serveur de messagerie d'essai (`labo/run-courrier-relais.mjs`),
jamais avec une vraie messagerie, ni avec l'instance d'une administration.

## Le circuit

```
app (Publipostage+, Form+, Automation+…)   écrit une ligne « à envoyer »
        │
        ▼
GFS_Courrier  (table du document, créée par GFS avec l'accord de la personne)
        │  Grist : webhook sur les lignes dont le statut est « à envoyer »  (en-tête Authorization: Bearer <secret>)
        ▼
relais.mjs    règles → SMTP (STARTTLS ou TLS d'emblée) → accusé
        │
        ▼
formulaire public de GFS_Courrier_Retours  (le relais ne détient aucune clé du document)
        │
        ▼
GFS_Courrier.Statut  passe à « envoye » ou « erreur » (formule : l'accusé doit porter la clé de la ligne)
```

## Mise en route (sans écran pour l'instant)

1. **Dans le document** : `ensureOutbox` (js/mail/outbox.js) crée `GFS_Courrier` et `GFS_Courrier_Retours` après l'accord de la personne. Puis le formulaire de
   `GFS_Courrier_Retours` est publié (`ensureForm` du moteur de partage) et la personne copie son lien : c'est l'adresse d'écriture (`…/api/s/<clé>/tables/GFS_Courrier_Retours/records?flat=1`).
   Grist ne donne cette clé à aucun widget.
2. **Le relais** : `node prototype/outils/relais-courrier/relais.mjs` avec ces réglages d'environnement (Node 22, aucune dépendance) :

   | Réglage | Sens |
   |---|---|
   | `RELAIS_SECRET` | le secret de GFS (32 caractères au moins), que `armRelay` pose dans le webhook |
   | `SMTP_URL` | `smtp://utilisateur:motdepasse@hôte:587` (STARTTLS exigé) ou `smtps://…:465` ; `?tls=none` seulement vers la machine elle-même |
   | `SMTP_CA` | (facultatif) fichier PEM d'une autorité à croire en plus du système |
   | `DE` | l'adresse d'expédition (celle du compte SMTP) |
   | `ACCUSE_URL` | l'adresse d'écriture du formulaire des accusés (point 1) |
   | `ECOUTE` | `adresse:port` (127.0.0.1:8787 par défaut) : le https est porté par un serveur web devant lui |
   | `MEMOIRE`, `PAR_HEURE` | fichier où le relais retient ses envois (7 jours), plafond d'envois par heure (200) |

3. **Le webhook** : `armRelay` (js/mail/outbox.js) pose le webhook de `GFS_Courrier` vers l'adresse https du relais, avec le secret. Le serveur Grist doit
   accepter cette adresse (`ALLOWED_WEBHOOK_DOMAINS` quand l'instance est auto-hébergée).

## Ce que le relais fait, et ne fait pas

- **Il revérifie tout** (`js/mail/rules.js`) : adresses nues en ASCII, aucun retour à la ligne dans un champ d'en-tête (c'est ainsi qu'on glisse un « Bcc: »),
  50 destinataires au plus, plafonds de taille. Une ligne refusée est accusée « erreur » avec son motif et ne bloque pas les autres.
- **Il n'envoie jamais deux fois la même demande** : Grist retente une livraison tant que le relais n'a pas répondu 2xx (1, 2, 4, 8 s… puis jusqu'à 64 s,
  mesuré jusqu'à 8 s). Chaque envoi est retenu par (ligne, clé, relance). **Renvoyer** une ligne (`requeue`) monte sa relance : c'est un envoi voulu.
- **Un échec passager** (serveur de messagerie muet, 4xx, plafond horaire) répond 502 : Grist retente. Un refus définitif (5xx, règle) est accusé « erreur ».
  Au-delà de la durée des tentatives de Grist (une vingtaine, un quart d'heure environ, lu dans le kit), la ligne reste « à envoyer » : la renvoyer.
- **Il n'écrit qu'à l'adresse de son réglage** et n'envoie que par son serveur de messagerie ; il ne lit aucune adresse dans ce qu'il reçoit.
- **Il ne voit pas les pièces jointes** : une ligne ne porte que du texte (et du HTML facultatif). Une pièce jointe passerait par un envoi depuis le navigateur.
- **Le journal ne contient ni adresses ni texte** : le relais écrit seulement les avertissements (accusé non rendu, mémoire non écrite).

## Ce qu'un lien public permet

Le formulaire des accusés est public : quiconque a le lien peut y ajouter une ligne. Elle ne compte que si elle porte **la clé de la ligne de la boîte d'envoi** (tirée
par Grist à la création de la ligne, lue seulement par les éditeurs du document et par le relais) : une fausse clé est acceptée par le formulaire mais ne change rien
(mesuré). La clé est donc le secret de l'accusé ; couper le lien (GFS le renouvelle) suffit si elle fuit.

## Variante Google Apps Script

`apps-script.gs` : le même contrat dans un script Google (aucun serveur), **écrit mais pas essayé**. Elle ne lit pas l'en-tête `Authorization` (le secret va dans
l'adresse, `?cle=`), répond toujours 200 (Grist ne retente pas : un échec est accusé « erreur », on renvoie la ligne) et plafonne à 100 destinataires par jour avec un
compte gratuit. Ouvrir « …/exec?cle=<secret>&essai=<adresse> » dans un navigateur envoie un message d'essai (déploiement et autorisation de Google). Apps Script répond par une redirection à un envoi POST : si Grist la traite comme un échec, il retentera, et la mémoire du script (6 heures) évite les doublons.

## Essais

```
node --test test/courrier-boite.test.mjs test/courrier-relais.test.mjs     # sans Grist (fausses réponses)
GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash prototype/labo/vrai-serveur.sh
cd prototype/labo && REPO_DIR="$(realpath ../..)" node run-courrier-relais.mjs   # vrai Grist, vrai relais, serveur de messagerie d'essai
```
