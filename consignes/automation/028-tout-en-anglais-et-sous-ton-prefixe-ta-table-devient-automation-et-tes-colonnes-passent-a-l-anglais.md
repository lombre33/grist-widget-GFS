# 028 · Tout en anglais, et sous ton préfixe : ta table `Automation` devient une table `Automation_…`, tes colonnes passent à l'anglais dès tes nouveaux documents

App : Automation+ (`lombre33/GRIST_automation`) · posée le 25/11/2026 · remplace rien · décision du porteur du 25/11 (« tout en anglais partout » ; puis, à 11 h 41 : « automation+ n'a pas encore été déployé donc on renomme avec préfixe proprement pour préparer son lancement en alpha ») · contrats 2.2 (préfixe) et 2.5, point 4 (`arrivee`, `aussi`) · guide des apps 1.1, point 15
quand : à ton prochain lot ; ta liste de noms d'abord (dans « Demandes à GFS »), puis du code dans ton app ; rien d'autre à migrer : l'app n'est chez personne

## Quoi

**1. La décision du porteur (25/11).** Tout passe en anglais partout (code, tables, colonnes) ; l'interface reste française et anglaise ; **aucun document ni arborescence perdu**, **pas de table de plus** (un renommage se fait sur place, jamais par copie) ; **GFS lit toujours les deux jeux de noms, sans date de fin** ; la personne le sait avant, par une fenêtre qui ne se passe pas, et **seulement si elle peut le faire** ; les gens sont toujours sur le lien de la dernière version. **Pour toi, il a précisé** que ton app n'est **pas encore déployée** : on renomme donc **proprement, avec ton préfixe**, avant ton lancement en alpha, et il n'y a pas de document de gens à migrer.

**2. Ce que ça change** :
- **Ta table sort de la règle du préfixe aujourd'hui.** Ton préfixe est `Automation_` (contrats 2.2) et ta table s'appelle `Automation` : GFS la classe parmi les tables **de la personne**, pas parmi les tiennes (mesuré le 25/11). Elle prend donc un nom **sous le préfixe**. Proposition de GFS : **`Automation_Store`** (ta table garde les lignes `Workflow`, `Log` et `Lock`, comme ton `js/store.js`). Ton nom fait foi : dis-le.
- **Tes colonnes en anglais** (propositions, ta liste fait foi) : `Actif` → `Active`, `Resume` → `Summary`, `Evenement` → `Event`, `Ligne` → `Row`, `Resultat` → `Result`, `Auteur` → `Author` ; `Type`, `Table`, `Date`, `Version`, `Config` et `Detail` sont déjà anglais et ne changent pas.
- **Tes nouveaux documents** naissent avec la table et les colonnes anglaises (création avec l'accord de la personne, comme aujourd'hui ; relis l'identifiant réel après l'`AddTable`, faits vérifiés 158). La colonne `Author` garde sa formule déclenchée à la création (`user.Email`).
- **Un document d'essai qui a déjà `Automation`** (le tien, celui du porteur) : ton app **lit les deux jeux de noms** (table et colonnes), **ne crée jamais la nouvelle table quand l'ancienne existe** et continue sur l'ancienne ; **rien n'est renommé en place** (GFS ne laisse pas une app renommer une table hors de son préfixe, et il n'y a personne à migrer : pas de fenêtre à ajouter chez toi). Le porteur refera ses documents d'essai s'il veut les noms anglais.

**3. Livré côté GFS (25/11).** Ton `arrivee` (la ligne `Workflow` de ta table, contrats 2.5, point 4) accepte maintenant **`aussi`** : les autres noms de ta table. GFS lit **celle qui a des lignes** sous le nouveau nom puis sous l'ancien ; si les deux en ont, ou aucune, la nouvelle (testé sur un document simulé : une vraie mesure suivra avec ta version). Quand tu as répondu, GFS écrit dans ta fiche `arrivee: { table: <ton nom>, aussi: ["Automation"], … }` et met à jour le texte de ta formule (« Auteur » devient « Author »), quand il lit ta réponse, **avant** d'avancer la référence de ton app (un commit à part). **Tu n'as besoin ni de la capacité `renommage` ni de la fenêtre commune** : tu ne renommes aucun document existant. Si tu déclares un jour des `classes` (contrats 11.2), ce sera avec les noms anglais.

**4. Ce que tu fais** (dans l'ordre) :
- **a.** Donne ta liste complète, dans « Demandes à GFS » : la table, ses douze colonnes, et tout autre nom que ton code crée, lit ou écrit (une table de plus ? une colonne posée plus tard ? une clé de réglage qui porte un nom français ?), avec le nom d'aujourd'hui et le nom anglais.
- **b.** Ton code lit et écrit sous les noms que **le document a** : un document aux noms d'avant continue sur ses noms, un document neuf prend les anglais ; jamais les deux jeux dans un même document. Annonce tes noms dans « Changements qui touchent GFS » **avant** de publier (contrats 2.4, point 6).
- **c.** Une écriture qui répond « table introuvable » ou « colonne introuvable » : relis les noms et recommence **une fois** ; sinon dis « Rechargez la page » (guide 1.1, point 15). Tes automatisations tournent en fond : c'est le cas où un onglet reste sur d'anciens noms.

**5. Une question** (ta réponse va dans « Demandes à GFS » de `GFS-ETAT.md`) : lire **les deux jeux de colonnes** d'une même table (`Resume` ou `Summary`…) te coûte-t-il beaucoup de code ? Si oui, dis-le : ce serait pour des documents d'essai que seul le porteur a, et il choisira entre ce code et refaire ses documents.

## Pourquoi

Aucun document de gens ne porte tes noms : c'est le moment le moins cher pour passer à l'anglais et sous ton préfixe, plutôt que d'avoir un jour une migration à faire passer par une fenêtre. Sans le préfixe, GFS ne pourrait jamais laisser ton app renommer sa propre table.

## Fait quand

`GFS-ETAT.md` donne « 028 · faite · lue » avec : ta liste de noms (table, colonnes, le reste) et la réponse à la question ; puis, quand le code est fait, le commit qui crée les tables anglaises dans un document neuf, qui lit un document aux noms d'avant sans rien y changer, et la mention que `Author` garde sa formule. GFS mesure avec ta version dans un vrai Grist quand tu avances la référence.
