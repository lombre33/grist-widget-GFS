# 046 · Une ligne reçue par un lien public est du texte non fiable : dis dans ta page d'état comment Publipostage+ la traite, et ce qu'il lance de lui-même

App : Publipostage+ · posée le 04/11/2026 · contrats de GFS 11.6 (point 9) et 11.9 (point 5) ; ce que reçoit un lien public : décision du porteur du 04/11 (11.7, point 9) ·
quand : au prochain lot, sans urgence ; **aucun code exigé** : un relevé de ton code, écrit dans ta page d'état ; vaut aussi dans l'app seule (un lien public ne passe pas par GFS)

## Quoi

**1. Ce qui change pour toi.** Un formulaire publié (natif de Grist ou de Form+) laisse n'importe qui écrire une ligne dans le document, sans compte et sans passer par GFS. Le porteur a tranché
le 04/11 où cette ligne arrive : dans **la table du formulaire**, une par formulaire (contrats 11.7, point 9). C'est une table ordinaire du document : tu peux la lier à ta vue comme n'importe quelle
autre, et ses lignes se fusionnent dans tes modèles. Grist ne vérifie rien de ce qu'un lien écrit : une colonne que le formulaire ne montre pas, une colonne à formule déclenchée (une date de
réception, un auteur), un choix hors de la liste, du texte dans un nombre, tout est gardé tel quel (11.9, point 3). **Toute ligne venue d'un lien est une entrée non fiable, même dans une colonne
que tu crois remplir toi-même.** Rien ne te dit aujourd'hui quelle table un lien remplit (GFS pourrait te le dire : 11.7, point 11, ouvert) : une ligne reçue ressemble à une autre.

**2. La règle** (11.6, point 9 ; 11.9, point 5), la même pour toute app : (a) une valeur de donnée est du texte non fiable : tu l'échappes, tu ne la prends jamais pour du code, une formule ou une
adresse de script ; (b) tu ne lances rien de toi-même (envoi, workflow, document) à partir des lignes d'une table qu'un lien public remplit. Publipostage+, Automation+ et Grist-BI le disent dans
leur état : c'est l'objet de cette consigne.

**3. Ce que tu fais : lire ton code et le dire, à la ligne de la 046 de `GFS-ETAT.md`.**

1. **Où une valeur de cellule entre dans un écran, un document ou une adresse, et ce que tu en fais.** D'après ton README, au moins : le contenu fusionné dans l'éditeur et dans la Lecture ; les
   exports (PDF, Word, Excel, Markdown, HTML, impression) ; la Grille et son export Excel (une valeur qui commence par `=`, `+`, `-` ou `@` est-elle écrite comme du texte, jamais comme une
   formule ?) ; le lien `mailto:` du modèle e-mail (À, Cc, Cci, objet, corps : une valeur qui porte `?`, `&`, une virgule ou un saut de ligne n'ajoute ni destinataire ni champ) ; les liens
   (`http`, `mailto:`, `tel:`) et les images dont l'adresse vient d'une valeur (quels schémas acceptes-tu ? une valeur `javascript:…` passe-t-elle ?) ; ta propre marque de variable
   (`#Table.Colonne`) quand une valeur la contient (est-elle fusionnée une seconde fois ?) ; les règles du macro-modèle (une valeur choisit une annexe : elle est comparée, jamais évaluée).
   Pour chaque endroit, dis « échappée » ou « jamais lue comme code », avec le fichier et la ligne, comme au relevé de la 001.
2. **Ce que Publipostage+ lance sans geste de la personne à partir des lignes d'une table** : envoi, document, export, écriture. Si c'est « rien », dis-le.

Un endroit du point 1 qui ne tient pas est un défaut ordinaire de ton app : corrige-le à ton rythme et dis-le sur la même ligne. Un lancement du point 2 est ta fonction, pas un défaut : ne le change
pas, dis-le ; GFS en fait une carte de décision pour le porteur avant toute consigne de code.

## Pourquoi

Le porteur, le 22/10 : un formulaire est « une porte d'entrée pour venir écrire des bêtises dans un document », et il faut une vigilance de tous les instants (11.9). Depuis le 04/11, ses réponses
arrivent dans une table du document que tes modèles lisent comme une autre : le texte d'un inconnu peut finir dans un document que la personne affiche, imprime, exporte ou envoie. Le relevé est le
premier pas : GFS sait ce que chaque app fait avant de penser à un garde-fou, et ne code rien tant que les apps n'ont pas dit.

## Fait quand

`GFS-ETAT.md` donne « 046 · lue » maintenant, puis « 046 · faite · `commit` » (ou « faite · lue, aucun code » si ton code n'a pas bougé) quand la ligne dit, pour le code lu à ce commit, les deux
points de la section 3. GFS n'a rien à rejouer chez toi : il lit ta page, passe la consigne à « faite » et, si un lancement du point 2 touche une ligne reçue, pose la carte au porteur.
