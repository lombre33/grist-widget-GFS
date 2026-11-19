# 024 · Le kit 0.25.0 relaie à GFS les appels que ta politique de sécurité bloque : une ligne en tête de ton module d'entrée (règle S8)

App : Automation+ (`lombre33/GRIST_automation`) · posée le 18/11/2026 · décision du porteur du 18/11 (« alertes relayées par les apps ») · cahier 3.2.1 (S8) et 3.2.2 · guide des apps 1.4 · contrats 5.4, point 14 · kit 0.25.0
quand : à lire au prochain lot, sans urgence ; une ligne de code et une référence du kit à avancer ; S8 est attendue, pas exigée ; décision du porteur du 18/11

## Quoi

**1. Avance la référence du kit** au commit `a1ed9db` (kit 0.25.0 ; le cloud ne peut pas poser l'étiquette `v0.25.0`, la référence est le commit). Rien d'autre ne change dans le kit pour toi : `GfsLink` gagne seulement `tell(nom, args)`.

**2. Démarre le relais.** Ton app a le lien du kit : **`import './kit/js/violations-start.js';` en tête de ton module d'entrée**, avant tout autre import. Ta politique est déjà la plus stricte de la suite : c'est elle qui donnera au relais quelque chose à dire si une bibliothèque tente un appel.

**3. Ce que le relais fait** : quand la politique de sécurité de ta page bloque un appel (une bibliothèque piratée qui tente d'envoyer des données ailleurs, par exemple), le kit le dit à GFS. **Seul le nom d'hôte part**, jamais le chemin ni les paramètres. GFS l'affiche dans « Réglages › Dépendances › Sécurité » et avertit la personne. **Cela informe, cela ne protège pas** : la protection est ta politique ; un code piraté peut taire le relais ; un appel que ta politique permet ne lève aucun événement.

**4. Dis-le dans ton `GFS-ETAT.md`** : dans ta section « Sécurité », la ligne S8 (tenue avec la date de ta référence du kit, ou en cours avec une date). GFS lit ta page et ton code : s'il y trouve l'import ou l'appel du relais, il met S8 à « tenue » ; sinon, « à noter ». À l'usage, la fenêtre dit « Relais actif depuis l'ouverture (kit 0.25.0) » dès que ton app a démarré le relais.

**5. Mesure-le dans un vrai Grist** (console ouverte) : ouvre ton app sous GFS, puis tente (dans la console de ton cadre) un `fetch('https://exemple.test/x?secret=1')` : GFS doit avertir la personne avec **`exemple.test`** seul, sans `secret`.

## Pourquoi

Le porteur a demandé le 18/11 une alerte si une bibliothèque se met à faire un appel que la politique n'a pas prévu (compromission d'un serveur de commande). GFS ne voit un cadre d'app que de l'extérieur : seule ton app peut dire ce que sa politique a bloqué, et le kit est fait pour cela. Mesuré dans un vrai Grist (faits vérifiés 135) : un `fetch` tiers, une image tierce et un script en ligne bloqués dans une app d'essai arrivent à GFS comme trois alertes, hôte seul.

## Fait quand

Ta référence du kit est au commit `a1ed9db` ou après, ton module d'entrée démarre le relais, et ta ligne S8 de `GFS-ETAT.md` est à jour. GFS le lit (ta page et ton code, puis « Relais actif » à l'usage) et passe cette consigne à « faite ».
