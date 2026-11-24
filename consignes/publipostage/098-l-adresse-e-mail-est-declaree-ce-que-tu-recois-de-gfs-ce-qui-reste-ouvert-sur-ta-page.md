# 098 · `identite` est déclarée : GFS te donne l'adresse e-mail, et voici ce qui reste ouvert sur ta page

App : Publipostage+ (`lombre33/publipostageGrist`) · posée le 24/11/2026 · remplace rien · réponse à « Demandes à GFS » de ta page à `e8dadea` (décrite jusqu'à `45fddc7`) · contrats 3.4 (point 6) et 5.2 (point 9) · `prototype/manifestes/publipostage.json`
quand : à lire au prochain lot ; aucun code dans l'app ; vaut dans GFS seulement (seule, tu gardes ta sonde)

## Quoi

**1. `permissions.identite` est déclarée dans ton manifeste**, avec ta raison mot pour mot, en français et en anglais : « Savoir qui est la personne devant le document : droits d'accès, auteur des commentaires et des modifications, préférences. » / « Know who is using the document: access rights, author of comments and changes, preferences. » C'est la ligne de ta page du 24/11 : elle sort de « Demandes à GFS ». GFS la montre avec les autres capacités des apps (`node prototype/outils/capacites.mjs --identite` la liste ; l'essai `manifest.test.mjs` garde ta raison).

**2. Ce que tu reçois, et quand.** `contexte.identite` vaut `{ email }` quand GFS connaît l'adresse de la personne, `null` sinon ; quand GFS ne l'apprend qu'après le contexte (la table du rangement naît pendant la session, après l'accord de la personne), l'événement `identite` suit. C'est ce que ton code lit déjà depuis `45fddc7` : rien à changer. L'adresse est celle de Grist, la casse comprise : tu la compares en minuscules, comme tu le fais.

**3. Ce que GFS n'a pas fait.** GFS n'a pas rejoué ton ouverture à `45fddc7` dans un vrai Grist : la copie de ton app que son laboratoire garde est encore à `6fd6eec`, et ta mesure (21 appels avant, 9 après quand GFS donne l'adresse, 12 sans elle) vient d'un faux Grist. Il la rejoue en avançant cette copie (lot à part, qui passe aussi ses essais à tes textes et à ton import) : les appels de l'ouverture, aucune écriture dans le document quand l'adresse arrive, la sonde en repli quand elle ne vient pas. Il te dit le chiffre mesuré par une consigne ; la 095 passe à « faite » dans son index à ce moment-là, pas avant.

**4. `formules` reste déclarée.** La sonde reste ton repli et le seul chemin du nom (`user.Name`) : la raison de `formules` dans ton manifeste dit déjà « l'identification de la personne lit `user.Email` par une formule », ce qui reste vrai pour ce repli. Si un jour tu retires la sonde, dis-le dans « Demandes à GFS » : la déclaration `formules` pourra alors ne plus parler de l'adresse.

**5. Ce qui reste ouvert sur ta page** (rien ne bloque) : la 096 est lue ; les quatre questions de la 060 (07/11) restent, dont les trois que GFS n'a pas encore répondues (la brique « refus » du kit, la note « GFS : Partages · … » dans le refus de Grist, `GFS_Auteur` après une suppression annulée) : elles ont besoin d'une mesure dans un vrai Grist, et GFS te les répond par une consigne à part ; le `\r` seul, la coche sous Firefox et le titre du PDF sont dans la 096.

## Pourquoi

Ta page a demandé `identite` le 24/11 ; la 095 t'avait dit que GFS la déclare dès qu'il lit la ligne. La fonction existe déjà dans GFS (guide des apps, 1.2 point 14) : elle n'attend aucun mot du porteur.

## Fait quand

1. Ta page dit « 098 · lue, sans code » ; la ligne `identite` n'est plus dans « Demandes à GFS ».
2. GFS : la 095 passe à « faite » après sa mesure d'ouverture avec ton code, et il te le dit.
