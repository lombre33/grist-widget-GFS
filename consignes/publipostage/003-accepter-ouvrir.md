# 003 · Accepter « ouvrir » de GFS

App : Publipostage+ · posée le 14/10/2026 · quand : pour que la V0.1 du prototype de GFS ouvre le modèle sur lequel la
personne a cliqué ; sans effet dans l'app seule

## Quoi

Hébergée par GFS, l'app ouvre le modèle que GFS lui désigne et dit pourquoi dans son coin d'état. Les messages sont ceux de
`docs/contrats.md` (GFS, sections 5.1, 5.2 point 3 et 5.4) ; ce contrat est un brouillon qui évolue avec le prototype, et GFS
annonce tout changement de message par une nouvelle consigne.

1. **Savoir qu'elle est hébergée.** L'adresse du sous-cadre porte `gfs=<n>` (contrats, 1.3 point 3). Sans ce paramètre, l'app
   ne parle pas à GFS et se comporte exactement comme aujourd'hui.
2. **À l'arrivée.** Hébergée, l'app appelle `contexte` (enveloppe de 5.1, avec `gfs: 0` ; 5 secondes d'attente au plus, sans
   réponse elle démarre comme aujourd'hui) et lit `ouverture` :
   - `fichier` vaut `{ id, type }`, où `id` est le numéro de ligne du modèle dans `Publipostage_Modeles`, pris comme texte :
     l'app ouvre ce modèle **avant** le reste de son ordre d'arrivée (la ligne, le modèle de la vue, ★) ;
   - `ouverture` vaut `null`, ou `fichier` vaut `null` (c'est « Nouveau », hors de cette consigne), ou le modèle est
     introuvable : l'ordre d'arrivée habituel.
3. **Quand elle est déjà ouverte.** GFS lui envoie l'appel `ouvrir` `{ fichier, type, dossier, raison }`. Elle ouvre le modèle
   par le chemin du sélecteur, donc avec sa question « Enregistrer / Abandonner / Annuler » si des modifications attendent, et
   répond `{ ouvert: true }`. Elle répond `{ ouvert: false }` si la personne annule, si le modèle est introuvable ou si la
   garde de la consigne 002 ne l'ouvre pas.
4. **Dire pourquoi.** Dans le coin d'état, un texte court selon `raison` : pour `explorateur`, « depuis l'explorateur ». Une
   raison qu'elle ne connaît pas n'affiche rien. Français et anglais dans le même lot.

Le chemin existe déjà : `openTemplateForRow` (`js/main.js`, ligne 511) ouvre un modèle par son identifiant, par le chemin du
sélecteur, et rend vrai ou faux ; l'ordre d'arrivée est dans `init()` (`startupTemplateId`, ligne 2882). Lignes relevées sur
`89ebdd2` le 14/10, à relire sur `origin/main`.

L'écoute des messages de GFS suit la règle 7 du guide (1.1) : `addEventListener('message')` en vérifiant `event.source`
(`window.parent`), jamais `window.onmessage =`. Tout ce qui parle à GFS tient dans un fichier à part, pas dans `js/main.js` :
ce sera le point de départ du client du courtier du kit (étape 3).

## Pourquoi

Le prototype de GFS (V0.1) montre les modèles du document dans son explorateur ; un clic doit ouvrir Publipostage+ sur ce
modèle, pas sur celui qu'elle ouvre d'habitude. Tant que cette consigne n'est pas faite, le prototype ouvre l'app sur son
modèle habituel. C'est aussi le premier message de GFS que l'app comprend (cahier 4.3 et 5.6).

## Fait quand

Un test échoue sur le code d'avant et passe après : l'app, avec `gfs=0` dans son adresse et un GFS simulé par le test qui
répond à `contexte` avec l'`id` d'un modèle autre que son modèle habituel, ouvre ce modèle et écrit sa raison ; un appel
`ouvrir` ensuite change de modèle (avec la question d'enregistrement si des modifications attendent) et reçoit
`{ ouvert: true }` ou `{ ouvert: false }` ; sans `gfs` dans l'adresse, rien n'est envoyé et l'ordre d'arrivée est celui
d'aujourd'hui. La mesure dans un vrai Grist se fait ensuite avec le prototype. À vérifier comme le reste de l'interface :
700 × 400, clair et sombre, français et anglais. `GFS-ETAT.md` donne la ligne « 003 · faite · `commit` ».
