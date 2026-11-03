# 008 · L'adresse e-mail de la personne : GFS la donne aux apps qui la déclarent (kit 0.4.0)

App : Tuesday · posée le 03/11/2026 · réponse à ta demande n° 2 (« Identité et permissions centralisées », `docs/demandes-a-gfs.md`, section 8) ·
quand : au prochain lot qui touche « Mes tâches » ; sans effet dans l'app seule ; remplace le point 4 de la 003

## Quoi

Le porteur a décidé le 03/11 (carte « Donner aux apps l'adresse e-mail de la personne connectée ? », choix « Aux apps qui le déclarent ») : GFS donne l'adresse e-mail de la
personne connectée **aux apps qui le déclarent, et à elles seules**. Tu demandais la forme de l'identité, la forme des permissions et le repli seul.

**1. La forme de l'identité.** Déclare-la dans `gfs.json`, avec la raison que la personne lira à l'installation, en français et en anglais (le validateur refuse l'une des deux absente) :
`"permissions": { "identite": { "pourquoi": { "fr": "…", "en": "…" } } }` ; par exemple « Pour « Mes tâches » : montrer les tâches de la personne qui est là » et « For “My tasks”: show the
tasks of the person who is here ». Elle ne demande aucun accès à une table. GFS la donne alors dans le `contexte` : `contexte.identite` vaut `{ "email": "<adresse>" }` ou `null`
(contrats 5.2, point 9) ; quand il ne l'apprend qu'après t'avoir donné le contexte, il l'envoie par l'événement `identite`, une seule fois. L'adresse est celle de Grist, à la lettre près : compare-la
en minuscules avec ta liste de responsables. Dans le kit **0.4.0** (`a793837`) : `GfsLink.identity()` rend `{ email }` ou `null`, et `GfsLink.onIdentity(fn)` rappelle ton abonné à l'arrivée du
contexte et à chaque changement. Si tu n'as pas encore avancé `kit/` pour la 005, avance-le directement à `a793837` (il contient la 0.3.0), dans un commit à part comme d'habitude.

**2. Le repli : `null`.** Il veut dire quatre choses que tu ne peux pas distinguer : tu ne l'as pas déclarée ; GFS ne connaît pas encore la personne (la table de rangement de GFS n'existe pas dans un
document neuf, elle naît au premier geste de la personne, avec son accord) ; le document est en lecture seule ; Grist ne donne pas d'adresse de personne (l'anonyme de Grist, une valeur qui n'est
pas une adresse). Seul, `GfsLink.identity()` rend toujours `null` : le kit n'écoute rien hors de GFS. Dans tous ces cas, fais comme seul : ta lecture de l'e-mail par l'API de Grist dans ta table
d'administration (créée avec l'accord de la personne), ou le défaut de la 003, « Je suis… » retenu par `GfsLink.storageSet`. Quand une adresse arrive, c'est elle qui reconnaît la personne ; le choix
« Je suis… » ne sert plus que de repli.

**3. Les permissions.** GFS ne centralise pas de droits : seul Grist refuse un droit à quelqu'un (contrats 11.1), par les règles d'accès qu'un propriétaire pose. Il n'y a donc pas de « forme des
permissions » à recevoir aujourd'hui, ni dans le contexte ni dans le courtier. Ce qui est écrit, et pas codé, est `contexte.role` (`{ proprietaire, responsableDe }`, contrats 5.2, point 8), pour
**griser, jamais pour décider** : tu ne grises que si `proprietaire` vaut `false`, et c'est Grist qui accepte ou refuse. Pour « qui peut modifier quoi » dans Tuesday : l'adresse te dit qui est là, la liste
de tes responsables par projet reste à toi (dans ta table), et un refus de Grist se dit tel quel, avec qui refuse, pourquoi et à qui s'adresser (contrats 11.6, point 3), sans cacher la fonction.

## Pourquoi

Ta demande n° 2 (décision du porteur du 03/11 : Tuesday vit seul et dans GFS, et dans GFS l'identité vient de GFS) levait le point 4 de la 003, qui disait qu'aucune identité ne passait dans le `contexte`.
« Aux apps qui le déclarent », parce qu'une adresse est une donnée sur la personne : chaque app dit pourquoi elle la veut, la personne le lit à l'installation, et un client peut lister les apps qui la
reçoivent (`node outils/capacites.mjs --identite`, dans GFS). GFS la lit déjà pour son propre rangement (la ligne-sonde, contrats 6.4, point 9) : il ne crée aucune table pour la donner. Mesuré le 03/11 dans
un vrai Grist, avec une sonde écrite comme toi avec le kit (faits vérifiés, section 15).

## Fait quand

`GFS-ETAT.md` donne « 008 · lue » maintenant, puis « 008 · faite · `commit` » quand `gfs.json` déclare `permissions.identite` avec sa raison en français et en anglais, que `kit/` est à `a793837` ou après,
que « Mes tâches » prend `GfsLink.identity()` (et `onIdentity` à l'arrivée d'une adresse) et que « Je suis… » sert encore quand il rend `null` ; tes essais le montrent avec `createGfsLink`. GFS le rejoue dans
GFS à ton entrée au catalogue, où `identite` s'affichera dans la fenêtre d'installation avec ta raison (étape 6).
