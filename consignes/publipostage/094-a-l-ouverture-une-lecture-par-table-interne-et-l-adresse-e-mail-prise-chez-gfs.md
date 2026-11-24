# 094 · À l'ouverture : une lecture par table interne, et l'adresse e-mail prise chez GFS au lieu de la ligne-sonde

App : Publipostage+ (`lombre33/publipostageGrist`) · posée le 24/11/2026 · mesure de GFS du 23/11 (étude « ouvrir les fichiers plus vite », faits vérifiés 147) · demande du porteur du 24/11 (« message à PP ») · rien à changer dans GFS pour la lecture ; une ligne dans ta page pour l'adresse
quand : à ton chantier d'ouverture, sans urgence ; du code dans l'app (l'ordre des lectures, la sonde), une demande à GFS ; vaut dans GFS, et seule pour la partie « une lecture par table »

## Quoi

GFS a mesuré l'ouverture d'un modèle de Publipostage+ depuis son explorateur, dans un vrai Grist (Chromium, ton app à la référence `6fd6eec`, 40 ms et 120 ms d'aller-retour). Deux choses viennent de toi :

**1. Chaque table interne se lit une fois par ouverture.** À l'ouverture, l'app fait **25 appels à Grist, dont 14 différents** : `_grist_Tables` ×4, la liste des tables ×4, les colonnes ×3, et la ligne-sonde de l'adresse (une écriture, une lecture, une suppression). La plupart arrivent juste après l'affichage du modèle : ils ne retardent pas le premier affichage, mais ils chargent Grist et retardent le moment où l'app est prête. Fais lire chaque table interne une seule fois (par une promesse partagée entre ceux qui la demandent, comme tu le fais déjà pour la sonde : `probeUserRow`) ; vise une dizaine d'appels. Sur un gros document, la lecture de la table des modèles (16 Mo, 40 modèles) prend 0,8 s et **bloque les autres lectures derrière elle** : la lecture suivante de `_grist_Tables` attend 0,75 s.

**2. L'adresse e-mail vient de GFS, la ligne-sonde devient le repli.** GFS donne l'adresse e-mail de la personne aux apps qui la déclarent (guide des apps, 1.2 point 14 ; contrats 3.4 point 6 et 5.2 point 9 ; kit 0.4.0, `GfsLink.identity()` et `GfsLink.onIdentity(fn)`, que ton kit 0.27.0 a). Le manifeste de Publipostage+ est tenu par GFS (`prototype/manifestes/publipostage.json`) : **demande-la dans la section « Demandes à GFS » de ton `GFS-ETAT.md`**, en une ligne (`identite` · la raison, en français et en anglais, que la personne lira à l'installation · ce qu'elle sert à faire chez toi : les droits d'accès, l'auteur des commentaires, « Modifié par »). GFS déclare `permissions.identite` dans ton manifeste dès qu'il lit la ligne (un commit à part), puis te répond. Le code ensuite :

- tant que `GfsLink.identity()` rend `null`, tu fais comme aujourd'hui (ta sonde : `null` veut dire « pas déclarée », « GFS ne la connaît pas encore » (sa table de rangement n'existe pas dans un document neuf), « document en lecture seule » ou « app seule » : tu ne peux pas les distinguer, le repli est obligatoire) ;
- quand elle rend `{ email }` (dans le contexte, ou plus tard par `onIdentity`), c'est elle qui sert : **plus d'écriture, de lecture ni de suppression à l'ouverture** ;
- le **nom** de la personne (`user.Name`) n'est pas dans l'identité de GFS : la sonde reste son seul chemin, au moment où une chip « Nom » le demande, plus à l'ouverture ;
- l'adresse est celle de Grist, à la lettre près : compare-la en minuscules.

**3. Si ton ordre de démarrage le permet (à toi de juger) : lis les modèles pendant que GFS prépare le contexte** plutôt qu'après. GFS a mesuré que le gain est faible à froid sur un document léger (le démarrage de ton app, 0,54 s, cache l'attente du contexte, 0,36 s) ; il peut compter sur un gros document.

**Ce que GFS fait de son côté** (livré le 23/11, `26ce345`, rien à faire chez toi) : sur un gros document (4 à 48 Mo), la première lecture de ta table des modèles est servie par la lecture que l'explorateur vient de faire, si personne n'a écrit entre-temps (empreinte du document vérifiée) : 0,13 à 0,18 s au lieu de 0,8 à 0,98 s. **Cette copie ne sert qu'une fois** (puis elle s'oublie, ainsi qu'à la première écriture) : lis la table des modèles **une seule fois** à l'ouverture, c'est ce qui en profite.

## Pourquoi

Le porteur veut des fichiers qui s'ouvrent plus vite, et il a dit que Publipostage+ a son propre chantier d'ouverture : cette consigne en donne les mesures. La ligne-sonde est une écriture que l'app fait à l'ouverture sans geste de la personne ; elle est inutile quand GFS donne l'adresse, et une app qui écrit au démarrage ne peut pas être démarrée cachée d'avance (une piste que GFS a étudiée et laissée de côté pour cette raison). Mesuré à froid : 0,72 s sur un document léger (le mur est le démarrage de l'app, 0,54 s jusqu'à la page chargée), 1,6 s sur 16 Mo avant la copie de GFS, 0,8 à 0,9 s avec elle. Une ouverture à froid sur six, sur le document de 16 Mo, l'app a fait neuf lectures de table de suite (≈ 8 s) : avec le GFS d'avant comme avec celui d'aujourd'hui, donc pas un effet de la copie ; une lecture partagée par table l'évite.

Ce que cette consigne ne demande pas : retirer la sonde (elle reste le repli et le chemin du nom), ni changer ce que l'app dit à la personne.

## Fait quand

1. À froid, sur un modèle ouvert depuis GFS, chaque table interne n'est lue qu'une fois (le banc de GFS compte les appels : une dizaine au lieu de 25), y compris sur le document de 16 Mo (pas de lecture répétée de la table des modèles).
2. Quand GFS donne l'adresse (`GfsLink.identity()` rend `{ email }`), l'ouverture n'écrit rien dans le document (plus de ligne-sonde) ; quand elle rend `null`, tu retombes sur la sonde, comme avant. Un essai à toi couvre les deux cas.
3. Ta page `GFS-ETAT.md` dit « 094 · faite » avec le commit, la ligne `identite` dans « Demandes à GFS » et, dans « Changements qui touchent GFS », la date et le commit. GFS lit le dépôt de ton app, déclare `identite` à ta demande, rejoue la mesure d'ouverture (même banc que le 23/11), puis passe cette consigne à « faite ».
