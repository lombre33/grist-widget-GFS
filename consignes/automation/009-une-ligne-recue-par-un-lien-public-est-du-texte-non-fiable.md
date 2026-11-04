# 009 · Une ligne reçue par un lien public est du texte non fiable : dis dans ta page d'état ce que ton déclencheur en fait et ce que tes actions écrivent

App : Automation+ · posée le 04/11/2026 · contrats de GFS 11.6 (point 9) et 11.9 (point 5) ; ce que reçoit un lien public : décision du porteur du 04/11 (11.7, point 9) ·
quand : au prochain lot, sans urgence ; **aucun code exigé** : un relevé de ton code, écrit dans ta page d'état ; vaut aussi dans l'app seule (un lien public ne passe pas par GFS)

## Quoi

**1. Ce qui change pour toi.** Un formulaire publié (natif de Grist ou de Form+) laisse n'importe qui écrire une ligne dans le document, sans compte et sans passer par GFS. Le porteur a tranché
le 04/11 où cette ligne arrive : dans **la table du formulaire**, une par formulaire (contrats 11.7, point 9). C'est une table ordinaire du document : tu peux la prendre pour table de ta vue, et
ton déclencheur « une ligne est créée » s'y accroche comme sur n'importe quelle autre. Grist ne vérifie rien de ce qu'un lien écrit : une colonne que le formulaire ne montre pas, une colonne à
formule déclenchée (une date de réception, un auteur), un choix hors de la liste, du texte dans un nombre, tout est gardé tel quel (11.9, point 3). **Toute ligne venue d'un lien est une entrée non
fiable, même dans une colonne que tu crois remplir toi-même.** Rien ne te dit aujourd'hui quelle table un lien remplit (GFS pourrait te le dire : 11.7, point 11, ouvert) : une ligne reçue ressemble à une autre.

**2. La règle** (11.6, point 9 ; 11.9, point 5), la même pour toute app : (a) une valeur de donnée est du texte non fiable : tu l'échappes, tu ne la prends jamais pour du code, une formule ou une
adresse de script ; (b) tu ne lances rien de toi-même (envoi, workflow, document) à partir des lignes d'une table qu'un lien public remplit. **Pour toi, la (b) est la lourde** : ton principe est
de réagir à une ligne créée. Cette consigne ne te demande pas de le changer : elle te demande de dire ce qui est. Publipostage+, Automation+ et Grist-BI le disent dans leur état.

**3. Ce que tu fais : lire ton code et le dire, à la ligne de la 009 de `GFS-ETAT.md`.**

1. **Ce que ton déclencheur fait d'une ligne reçue.** Un workflow actif se lance-t-il sur une ligne créée par un lien public, sans geste de la personne ? (Tu ne distingues pas ces lignes des
   autres.) Dis avec quels droits il écrit (ceux de la personne qui a la vue ouverte : un workflow qu'un éditeur pourrait changer s'exécuterait chez un propriétaire, 11.6) et ce qu'il peut écrire :
   ajouter une ligne, ou mettre à jour une ligne repérée par une clé, dans la table de la vue ou dans une autre.
2. **Où une valeur de la ligne devient autre chose que du texte.** `{Colonne}` et `{nom}` dans les valeurs d'une action : la valeur substituée est-elle écrite telle quelle, jamais évaluée, et
   jamais substituée une seconde fois (une valeur qui contient `{AutreColonne}`) ? La transformation (accoler, + − × ÷, majuscules, minuscules) : un texte reste-t-il un texte ? La clé qui repère la
   ligne à mettre à jour : une valeur reçue peut-elle viser une ligne d'une autre table, et laquelle ? La condition : la valeur est comparée, jamais évaluée. Le journal et les nœuds : le texte
   affiché est-il échappé ? Pour chaque endroit, dis « échappée » ou « jamais lue comme code », avec le fichier et la ligne, comme au relevé de la 001.
3. **Ce qu'il te faudrait de GFS pour tenir la (b)**, si tu le vois : savoir quelles tables un lien remplit (11.7, point 11), ou autre chose. Mets-le dans « Questions pour GFS ».

Un endroit du point 2 qui ne tient pas est un défaut ordinaire de ton app : corrige-le à ton rythme et dis-le sur la même ligne. Le point 1 est ta fonction, pas un défaut : ne la change pas, dis ce
qui est. Si un workflow se lance sur une ligne reçue d'un lien, GFS pose au porteur la carte « à quelles conditions un workflow peut-il se lancer sur ces lignes ? » avant toute consigne de code.

## Pourquoi

Un workflow qui se lance sur la ligne d'un inconnu écrit des lignes dans tes tables avec les droits de la personne qui a l'onglet ouvert, et leur contenu comme leur clé peuvent venir de lui. C'est
là que la règle de GFS (rien ne se lance sans le geste d'une personne sur ces lignes) et ton principe se rencontrent : le porteur ne peut trancher qu'avec ton relevé. Le porteur, le 22/10 :
un formulaire est « une porte d'entrée pour venir écrire des bêtises dans un document » (11.9).

## Fait quand

`GFS-ETAT.md` donne « 009 · lue » maintenant, puis « 009 · faite · `commit` » (ou « faite · lue, aucun code » si ton code n'a pas bougé) quand la ligne dit, pour le code lu à ce commit, les points 1
et 2 de la section 3. GFS n'a rien à rejouer chez toi : il lit ta page, passe la consigne à « faite » et, si le point 1 dit « oui », pose la carte au porteur.
