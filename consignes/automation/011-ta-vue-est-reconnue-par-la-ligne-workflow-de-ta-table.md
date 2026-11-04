# 011 · Ta vue est reconnue par la ligne `Workflow` de ta table : GFS rouvre Automation+ tout seul, sans la clé `workflow` (réponse à ta demande du 04/11)

App : Automation+ · posée le 04/11/2026 · contrats de GFS 2.5 (point 4), 2.8 et 7.4 (point 7) · décision du porteur du 04/11 (« GFS lit sa table ») ·
quand : à lire au prochain lot, sans urgence ; aucun code à changer ; vaut dans GFS seulement (seule, l'app n'a pas besoin de cette arrivée)

## Quoi

**1. Ce que GFS fait depuis le 04/11 (commit `28d7ce0`).** Ton manifeste (`gfs.json` côté GFS) déclare désormais où GFS reconnaît ta vue : `"arrivee": { "table": "Automation", "colonne": "Table", "lignes": { "Type": "Workflow" } }`.
À l'arrivée d'une section de GFS, si aucun réglage de la section ne désigne une app qu'on peut ouvrir ici, GFS lit ta table `Automation` (par sa propre connexion à Grist, rien n'est écrit) ; si une ligne `Type` = `Workflow`
porte, dans `Table`, la table de la section, **il ouvre Automation+ sans consigne** : tu appliques ton ordre d'arrivée habituel (le graphe de cette table). La clé de réglages `workflow` marche toujours (004) : si elle est là, elle parle d'abord, comme avant.

**2. Ce que GFS ne fait pas.**
- Un réglage de la vue parle **avant** la table : une vue de Publipostage+ (son modèle de la vue) reste à Publipostage+, même si ta table a une ligne `Workflow` pour la même table de Grist.
- Une ligne d'une autre table, ou une ligne `Log` ou `Lock`, ne désigne pas la vue ; une table `Automation` absente, vide ou illisible non plus (l'explorateur, comme avant). GFS ne crée jamais ta table pour la chercher.
- Il ne lit pas `Config` : une ligne `Workflow` dont le graphe est vide désigne quand même la vue.
- Il compare seulement des textes (l'identifiant de la table sans la casse) : aucune valeur lue n'est jamais prise pour du code ni pour une adresse.

**3. Ce que tu fais : rien à coder.** Trois choses sur lesquelles GFS compte désormais, à garder vraies ou à nous dire avant de les changer (une nouvelle consigne de GFS suivra, le manifeste est de son côté) :
- ta table s'appelle `Automation` ;
- la colonne `Table` de la ligne `Workflow` contient l'identifiant Grist de la table de la vue (ce que `Store.saveGraph` écrit aujourd'hui) ;
- c'est la ligne de type `Workflow` qui dit « cette vue est à moi » (`Type` = `Workflow`).
Si ton app change l'une des trois, dis-le dans ta page d'état (« Demandes à GFS »).

## Pourquoi

Ta demande du 04/11 (page `0c19c80`, 0.15.0) : ne plus écrire la clé `workflow` quand le graphe est dans la table (dans Grist seul, elle faisait apparaître « Enregistrer » à chaque changement), et pourtant que GFS rouvre ton app sur la vue du graphe (004).
Le porteur a choisi, le 04/11, que **GFS lit ta table** plutôt que de te faire poser une marque dans la vue : l'arrivée reste « comme avant GFS », sans rien écrire dans la section, et sans te demander de coder. Sans cela, une vue dont le graphe est dans `Automation` arrivait sur l'explorateur, et le graphe
ne tournait plus tant que la personne n'avait pas rouvert l'app à la main (ton app ne lance les workflows que vue ouverte).

## Fait quand

`GFS-ETAT.md` donne « 011 · lue » maintenant, puis « 011 · faite · lue, aucun code » (rien à changer chez toi). GFS l'a rejoué avec ta vraie app (0.15.0, `597fe02`) dans un vrai Grist, à la souris : un graphe rangé par ton app à la souris, GFS rechargé s'ouvre sur elle sans rien écrire ; le modèle de la vue de Publipostage+ passe avant la table ; la ligne d'une autre table ou de type `Log` ne désigne pas la vue ; 36 vérifications sur 36 en français / clair et en anglais / sombre (`faits-verifies.md`, section 35) ; il le rejoue à chaque avance de ta référence (`run-arrivee`, section 6).
