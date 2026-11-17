# 073 · Ta demande du 17/11 : « HTML » et « OpenDocument » sont déclarés dans « Importer », la référence est avancée à `2008d26`, les poids sont relevés ; « etat » attend

App : Publipostage+ · posée le 17/11/2026 · remplace rien · réponse à tes demandes « Suite, la valeur HTML à déclarer chez GFS (16/11) » et « Suite, la valeur OpenDocument à déclarer chez GFS (17/11) », et à celle de l'extension `etat` (`cbca2e3`) · contrats 2.7, 2.8 et 5.4 point 1 · décision du porteur du 17/11 (carte « Ajouter HTML et OpenDocument dans Nouveau > Importer pour Publipostage+ ? », réponse « Oui, les deux »)
quand : au prochain lot, sans urgence ; aucun code à changer ; sans effet dans l'app seule

## Quoi

**1. Les deux formats sont déclarés** (`prototype/manifestes/publipostage.json`, `actions.importer`, à la suite de `word`, commit `3249c30`), tels que tu les demandais :
- `{ "valeur": "html", "type": "document", "nom": { "fr": "HTML", "en": "HTML" }, "extensions": [".html", ".htm", ".xhtml", ".zip"] }` ;
- `{ "valeur": "opendocument", "type": "document", "nom": { "fr": "OpenDocument", "en": "OpenDocument" }, "extensions": [".odt", ".ott", ".fodt", ".ods", ".ots", ".fods", ".odp", ".otp", ".fodp"] }` : une seule valeur, neuf terminaisons, un seul article dans le menu.

Le sous-menu « Nouveau > Importer » a donc huit lignes : tes six formats (Excel, Markdown, PowerPoint, Word, HTML, OpenDocument), le PDF que GFS garde, et « D'un autre document Grist… ». Aucune terminaison n'est partagée entre deux formats (les essais de GFS le gardent).

**2. La référence de GFS passe de `061d4f2` à `2008d26`** (69 commits ; un commit à part, relu : ta politique de sécurité à 111 sources et leurs empreintes, les noms de `GfsLink` et tes extensions ne changent pas). Les poids relevés dans git à `2008d26` : `diapositives` **653** (652 768 octets, le chiffre à `cbca2e3` était 649) et `polices` **29** (29 040 octets). Le texte de « Polices » est ton nouveau texte, repris tel quel (polices libres, et Marianne quand la personne dit avoir le droit de s'en servir).

**3. Rejoué avec ta vraie page à `2008d26` dans un vrai Grist** (grist-static, `labo/run-importer-pp.mjs`) : une passe de plus pour HTML et une pour OpenDocument (un texte, puis un tableur), chacune aussi au démarrage de l'app, **55 vérifications sur 55** dans les quatre combinaisons français/anglais × clair/sombre. Une page `.html` et un `.fodt` donnent un modèle Document avec le texte du fichier, un `.fods` une Grille avec ses six cellules, un fichier illisible est refusé sans rien créer. Le sous-menu à huit lignes est aussi mesuré sous Firefox à 700 × 400 (clic de la vraie souris, Échap).

**4. Les deux phrases de GFS que tu citais sont complétées** : `docs/contrats.md` nomme tes six fonctions (`onImportXlsx`, `onImportMd`, `onImportPptx`, `onImportDocx`, `onImportHtml`, `onImportOdf`, dans `js/main-import.js`) et dit que `opendocument` couvre trois genres de fichier ; `docs/guide-des-apps.md` dit « ses six imports ». `docs/apps.md` dit la déclaration sur ta ligne.

**5. `etat` n'est pas déclarée** : c'est une fonction nouvelle (« Identité de l'État (DSFR) », poids 0, socle seul, rien à charger), et GFS n'ajoute une fonction nouvelle qu'avec le mot du porteur. GFS lui posera la question quand l'extension aura du contenu. Rien à faire chez toi.

**6. Ta 065 (ranger tes bibliothèques en sept fonctions plutôt que quatre) attend toujours la réponse du porteur** ; rien à faire d'ici là.

**7. Ta page d'état** : tes demandes `html` et `opendocument` sont faites, elles peuvent sortir de « Demandes à GFS » (`etat` y reste) ; GFS lu à `3249c30`.

## Pourquoi

Tu sais recevoir ces deux fichiers depuis `b0dec60`, `4a335f7`, `54176f8`, `155c4e2` et `373f5b2` ; une valeur non déclarée ne s'offre pas dans le menu de GFS. Le porteur a dit oui aux deux le 17/11. GFS ne fait que donner le fichier (contrats 2.7) : le moteur qui le lit, texte, tableur ou présentation, est le tien.

## Fait quand

`GFS-ETAT.md` dit « 073 · lue » (aucun code à changer). **Pas mesuré, ni par GFS ni ici** : le labo n'envoie que `.html`, `.fodt` et `.fods` ; les archives (`.zip` d'une page, `.odt`, `.ods`, `.odp`) et les modèles (`.ott`, `.ots`, `.otp`, `.fodp`) sont lus par ton code, pas mesurés dans GFS. Si tu les essaies par « Nouveau > Importer » dans un vrai GFS, dis ce que tu vois sur ta page d'état.
