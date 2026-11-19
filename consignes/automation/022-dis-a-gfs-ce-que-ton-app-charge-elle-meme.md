# 022 · Dis à GFS ce que ton app charge elle-même : la section « Bibliothèques que l'app charge elle-même » de ton `GFS-ETAT.md` (sans doute une ligne : « aucune »)

App : Automation+ (`lombre33/GRIST_automation`) · posée le 18/11/2026 · remplace rien · décision du porteur du 18/11 (« Oui, déclaré par chaque app ») · contrats 2.2 (`portees`), 2.6 point 17 · guide des apps 1.2, point 24
quand : à lire au prochain lot, sans urgence ; aucun code ; vaut dans GFS seulement ; décision du porteur du 18/11

## Quoi

**1. Ajoute à ton `GFS-ETAT.md` la section « Bibliothèques que l'app charge elle-même »** (format ci-dessous ; `consignes/LISEZ-MOI.md`, « Répondre »).

Une ligne par bibliothèque, ou par famille (un éditeur et ses dépendances : une ligne, avec `contient`) :

```markdown
## Bibliothèques que l'app charge elle-même
- <id> · <nom> · <version exacte, ou —> · <adresse https> · <démarrage | usage | option> · contient : <noms> · paquet : <nom npm> · <précision>
```

`démarrage` : chargée à l'ouverture de ton app ; `usage` : au premier usage de la fonction qui la demande ; `option` : seulement si la personne active l'option. L'adresse est celle que le navigateur contacte (ou ton propre site pour une copie de ton dépôt). Les trois dernières colonnes sont facultatives ; `paquet` sert à dire que GFS en garde aussi une copie. « aucune » si ton app ne charge rien. Mets aussi ce que tu as demandé à GFS de servir : la fenêtre n'en montre qu'une ligne dès que GFS le sert à ton app.

**2. Ce que GFS en sait** : d'après la lecture de ton dépôt à `1ee2887`, ton app ne charge aucune bibliothèque tierce. Si c'est exact, **la section tient en une ligne : « aucune »** ; la fenêtre « Dépendances » le dit alors sous ton app (« L'app déclare ne charger aucune bibliothèque elle-même »), ce qui n'est pas la même chose que ne rien dire. Si ton app charge quelque chose (une police, un service en ligne, un script de Grist), mets-le à la place.

## Pourquoi

Le porteur a demandé si la fenêtre « Dépendances » de GFS était exhaustive : elle ne l'était pas, elle ne listait que ce que GFS sert. Sa réponse à la carte « Afficher aussi ce que chaque app charge elle-même ? » (18/11) est **« Oui, déclaré par chaque app »** : GFS ne lit pas le code de toutes les apps et ne vérifie rien de ce qu'elles chargent, l'app est la mieux placée pour le dire. La fenêtre le montre sous ton app, dans un bloc « Portées par l'app », noté « déclarée par l'app, non vérifiée par GFS » : ce que tu écris est ce que la personne lit, sans plus de poids que ta page.

## Fait quand

Ton `GFS-ETAT.md` a la section « Bibliothèques que l'app charge elle-même » (ou « aucune »). GFS la lit (quand le porteur le demande, ou avant tout travail qui touche ton app), la recopie dans le manifeste qu'il tient pour toi (`portees`, un commit à part) et passe cette consigne à « faite » ; la fenêtre « Dépendances » montre alors, sous ton app, le bloc « Portées par l'app » avec tes lignes, ou dit que ton app n'en charge aucune. Tu n'écris aucun code, et rien ne change dans ton app.
