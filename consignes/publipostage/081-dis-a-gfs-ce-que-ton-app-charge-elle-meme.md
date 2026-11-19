# 081 · Dis à GFS ce que ton app charge elle-même : la section « Bibliothèques que l'app charge elle-même » de ton `GFS-ETAT.md` ; GFS montre déjà la liste que tu as donnée au porteur

App : Publipostage+ (`lombre33/publipostageGrist`) · posée le 18/11/2026 · remplace rien · décision du porteur du 18/11 (« Oui, déclaré par chaque app ») · contrats 2.2 (`portees`), 2.6 point 17 · guide des apps 1.2, point 24
quand : à lire au prochain lot, sans urgence ; aucun code ; vaut dans GFS seulement ; décision du porteur du 18/11

## Quoi

**1. Ajoute à ton `GFS-ETAT.md` la section « Bibliothèques que l'app charge elle-même »** (format ci-dessous ; `consignes/LISEZ-MOI.md`, « Répondre »).

Une ligne par bibliothèque, ou par famille (un éditeur et ses dépendances : une ligne, avec `contient`) :

```markdown
## Bibliothèques que l'app charge elle-même
- <id> · <nom> · <version exacte, ou —> · <adresse https> · <démarrage | usage | option> · contient : <noms> · paquet : <nom npm> · <précision>
```

`démarrage` : chargée à l'ouverture de ton app ; `usage` : au premier usage de la fonction qui la demande ; `option` : seulement si la personne active l'option. L'adresse est celle que le navigateur contacte (ou ton propre site pour une copie de ton dépôt). Les trois dernières colonnes sont facultatives ; `paquet` sert à dire que GFS en garde aussi une copie. « aucune » si ton app ne charge rien. Mets aussi ce que tu as demandé à GFS de servir : la fenêtre n'en montre qu'une ligne dès que GFS le sert à ton app.

**2. GFS a déjà écrit ta liste dans ton manifeste**, d'après ce que tu as dit au porteur le 18/11 (démarrage : l'éditeur et l'API de Grist ; premier usage : les sept bibliothèques d'export) et les versions de ta `package.json` (`75eefa9`). Elle s'affiche dès cette version de GFS ; **confirme ou corrige-la dans ta section** :

| id | nom · version | adresse | quand | contient |
|---|---|---|---|---|
| `tiptap` | TipTap 3.31.3 | `https://esm.sh/` | démarrage | ProseMirror, floating-ui, prosemirror-suggest-changes, linkifyjs |
| `grist-api` | API de Grist · — | `https://docs.getgrist.com/` | démarrage | |
| `pdfmake` | pdfmake 0.2.7 | `https://cdnjs.cloudflare.com/` | usage | polices (vfs_fonts) |
| `pdf-lib` · `jszip` · `exceljs` · `marked` · `qrcode-generator` | 1.17.1 · 3.10.1 · 4.4.0 · 15.0.12 · 1.4.4 | `https://cdnjs.cloudflare.com/` | usage | |
| `docx` | docx 9.15.1 | `https://cdnjs.cloudflare.com/` | usage | docx-charts (graphiques) |

**3. Les sept bibliothèques d'export restent déclarées ici tant que ta 065 n'est pas faite** : dès que GFS les sert à ton app (consigne 076), la fenêtre n'en montre plus qu'une ligne, celle de GFS, avec le choix de la source. Tu n'as rien à retirer.

**4. Si ton « Éditeur hors ligne »** (la copie de ton dépôt, `vendor/editeur`) change ce qui se charge, dis-le dans la colonne « précision » de la ligne `tiptap` : GFS la montre telle quelle.

## Pourquoi

Le porteur a demandé si la fenêtre « Dépendances » de GFS était exhaustive : elle ne l'était pas, elle ne listait que ce que GFS sert. Sa réponse à la carte « Afficher aussi ce que chaque app charge elle-même ? » (18/11) est **« Oui, déclaré par chaque app »** : GFS ne lit pas le code de toutes les apps et ne vérifie rien de ce qu'elles chargent, l'app est la mieux placée pour le dire. La fenêtre le montre sous ton app, dans un bloc « Portées par l'app », noté « déclarée par l'app, non vérifiée par GFS » : ce que tu écris est ce que la personne lit, sans plus de poids que ta page.

## Fait quand

Ton `GFS-ETAT.md` a la section « Bibliothèques que l'app charge elle-même » (ou « aucune »). GFS la lit (quand le porteur le demande, ou avant tout travail qui touche ton app), la recopie dans le manifeste qu'il tient pour toi (`portees`, un commit à part) et passe cette consigne à « faite » ; la fenêtre « Dépendances » montre alors, sous ton app, le bloc « Portées par l'app » avec tes lignes, ou dit que ton app n'en charge aucune. Tu n'écris aucun code, et rien ne change dans ton app.
