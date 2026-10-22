# 031 · Les permissions des personnes : ce que le contrat te demandera au lot de l'étape 5 (à lire maintenant, rien à coder)

App : Publipostage+ · posée le 22/10/2026 · répond à l'accord du porteur du 22/10 pour écrire le contrat des permissions · quand :
**à lire maintenant ; aucun code et aucune colonne avant la consigne qui suivra les mesures** ; le travail est celui du lot de
l'étape 5 (`gfs.json`) ; sans effet dans l'app seule

## Quoi

**1. Rien à changer aujourd'hui.** Le contrat des permissions des personnes est écrit en version 0 (`docs/contrats.md`, section 11).
Il ne devient définitif qu'après dix mesures sur le Grist du porteur (11.8), et chacune peut changer une règle. Tu ne codes donc
rien et tu n'ajoutes aucune colonne : la consigne qui suivra ces mesures reprendra les points ci-dessous, avec les noms.

**2. Ce que le contrat te demandera, au lot de l'étape 5** (11.6, point 8 ; tout est additif, et ton app seule garde ses tables
sous les droits de Grist, sans rien de plus à faire) :

- **Dire la classe de chaque table** dans `gfs.json` (`classes`, 11.2) : tes modèles sont `reserve` ; tes versions, tes
  commentaires et l'écriture en direct sont `derivee` ; tes préférences par personne sont `personnel`. Une table non déclarée est
  du travail courant : ni cachée, ni verrouillée, aucune règle.
- **Tolérer l'absence** : une ligne cachée, une colonne protégée, une table qu'un éditeur ne peut plus créer. L'app continue sans,
  et ne présente jamais une liste ou un total comme complet quand une partie n'est pas lisible.
- **Expliquer chaque refus** avec la brique « refus » du kit : qui refuse (Grist, l'app, le document), pourquoi, à qui s'adresser.
  La fonction reste grisée, jamais cachée.
- **Vivre sans la colonne du mot de passe commun d'un PDF protégé** (`secrets`, 11.2 et 11.6, point 7) : GFS n'en garde aucun en
  clair, et un non-propriétaire peut ne pas la lire. La saisir à chaque export, ce que ton app propose déjà.
- **Dire « seul un propriétaire enregistre ce réglage »** pour les quatre réglages de ta vue quand la structure du document est
  fermée (11.4, point 7). Tu grises d'après `contexte.role` (5.2, point 8), jamais pour décider : Grist décide.
- **Présenter ton tableau de droits comme un confort** : il masque des boutons, il ne protège rien.

**3. Pas dans cette consigne**, parce que ce n'est pas décidé (11.7) : les quatre colonnes de l'étiquette d'un contenu
(visibilité, personnes, auteur, espace) et qui les écrit ; la case « structure fermée » de Grist, que le porteur n'a pas encore
tranchée ; ce que l'auteur d'un contenu lit de ses versions et de ses commentaires. Si ton avis peut aider sur l'un d'eux, dis-le
dans le `GFS-ETAT.md`, sans rien coder.

## Pourquoi

Le porteur veut des droits qui sont ceux de Grist, jamais un verrou d'interface, et deux zones : les tables de données restent à
Grist, celles de GFS et des apps sont encadrées (cahier, section 2, décisions du 21/10). Il a donné son accord le 22/10 pour
écrire le contrat. GFS te le dit avant ton prochain lot pour que ton découpage de tables et ton `gfs.json` n'aient pas à être
repris.

## Fait quand

`GFS-ETAT.md` donne « 031 · faite · lue, aucun code » dès que tu l'as lue. Le travail se fait avec la consigne qui suivra les
mesures du porteur, que GFS annoncera ici.
