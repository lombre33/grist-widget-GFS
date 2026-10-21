# 009 · Ne jamais remettre un ancien nom : GFS renomme et range les formulaires depuis ses fichiers

App : Form+ · posée le 21/10/2026 · la suite annoncée dans la 008 (le rangement et le renommage par GFS) · quand : au prochain
lot, avec la 008 ; du code dans ton app (point 2) ; sans effet dans l'app seule

## Quoi

**1. Ce que GFS fait depuis ce soir** (`b49c2ba`, `13bd044` ; contrats 6.3, point 2, et 6.4 ; guide des apps 1.2, point 10) :
les fichiers de GFS épinglent, rangent et renomment eux-mêmes, avant qu'aucune app ne soit ouverte ou pendant qu'elle l'est
(le bouton « Fichiers » de la barre de GFS) :

- les favoris et les dossiers vont dans la table de GFS (`GFS_Rangement`, créée avec l'accord de la personne) : rien n'est
  écrit chez toi. Ton manifeste n'a pas de `rangement` : tes formulaires sont à la racine de l'explorateur tant que la personne
  ne les range pas. Rien à faire chez toi ;
- renommer écrit **la seule colonne `Nom`** de la ligne du formulaire dans `FormPlus_Formulaires` (`UpdateRecord`, après avoir
  vérifié que la colonne existe) : ni `DateModif`, ni `ModifiePar`, ni `Definition`. Un nom qu'un autre formulaire porte déjà
  est refusé dans la fenêtre (casse et espaces autour ignorés) ;
- Dupliquer et Supprimer restent à toi : l'explorateur les grise et dit qu'ils se font dans Form+.

**2. Ce que ton app fait : ne jamais remettre un ancien nom.** Aujourd'hui, `saveFormDefinition`
(`poc/js/grist-meta.js:412`, à `038dd1b`) met `Nom: saved.formTitle || …` dans chaque lot (ligne 416) : un formulaire renommé
dans GFS reprendrait le titre de sa définition au prochain enregistrement. Ton app ne met donc `Nom` dans le lot qu'à la
création de la ligne (`AddRecord`) et quand la personne a changé le titre du formulaire dans Form+ (comparé au `formTitle` de
la `Definition` qu'elle a lue ou écrite en dernier) ; sinon `Nom` reste hors du lot, le reste du lot ne change pas.

**Le choix le plus prudent, pris en attendant** : le nom donné dans GFS est celui du fichier, pas le titre que voient les
répondants. Renommer dans GFS ne change donc pas ce qu'ils voient ; changer le titre dans Form+ écrit le nouveau nom, comme
aujourd'hui. Si le porteur préfère que le titre suive le nom, la question passe par ta page (« Questions pour GFS »).

**Non mesuré** : aucun formulaire n'a encore de ligne dans nos essais (la 008 : il ne s'enregistre pas encore). GFS mesurera le
renommage avec ton app quand la 008 sera faite, comme il l'a fait pour Publipostage+ (son app ouverte, le nom changé dans
GFS, puis enregistré dans l'app : aujourd'hui l'ancien nom y revient, sa consigne 029).

## Pourquoi

Le choix du porteur du 21/10 : les fichiers de GFS épinglent, rangent et renomment eux-mêmes (« à faire par GFS »), en
n'écrivant que le nom dans la table de l'app (« Oui, le nom seul »). Sans le point 2, un nom donné dans GFS serait défait par
le prochain enregistrement de ton app.

## Fait quand

`GFS-ETAT.md` donne « 009 · faite · `<commit>` ».
