# 005 · GFS ouvre ton app depuis ton site en ligne, plus depuis une copie figée (à lire, rien à coder)

App : Automation+ · posée le 22/10/2026 · décision du porteur du 22/10 (« servir les dépôts live, pas une copie figée ») · quand : à lire
au prochain lot, sans urgence ; aucun code à changer ; sans effet dans l'app seule

## Quoi

**1. Ce que GFS fait désormais** (`4394fb0` ; contrats 1.3, point 2). Au lieu de la copie de ton sous-module (`f3ab8d6`), GFS ouvre ton
app dans son sous-cadre isolé depuis ton site en ligne : `https://lombre33.github.io/GRIST_automation/index.html` (l'origine de GFS, le site
de ton dépôt de développement et l'entrée de ton manifeste, `index.html`). Ce que tu pousses est donc ce que le porteur voit dans GFS,
après les 10 minutes de cache de GitHub Pages. Rien ne change pour la sécurité : le sous-cadre reste sans `allow-same-origin`, la CSP de
GFS ne bouge pas (`frame-src 'self'` laisse passer tous les sites d'un même compte), et l'adresse est calculée par GFS d'après son
catalogue, jamais lue dans un réglage, une table ou un message.

**2. Ce que ça te demande : de garder ce site publié**, avec ton entrée à la racine. S'il ne répond pas en 15 secondes, GFS ouvre la copie
du sous-module dans le même cadre et le dit une fois (« Automation+ : la dernière version ne répond pas, GFS ouvre sa copie figée. »).
Si l'adresse de ton site change (renommage du dépôt, bascule sous `grist-factory`), dis-le dans ta page d'état : GFS la reporte dans son
catalogue. Ton `GFS-ETAT.md` n'a plus à demander d'avancer la référence ; il prévient d'un changement de contrat (ce que GFS te donne ou lit,
tables, colonnes, clés de réglages, adresses, bibliothèques, permissions).

**3. Mesuré, et ce qui ne l'est pas.** Le chemin du site est joué dans le labo (vrai Grist, panneau 700 × 400, français / clair et
anglais / sombre) avec les fichiers de la copie rendus à l'adresse du site : sous-cadre isolé, bon fichier, `live=0` pour la copie, repli au
bout de 15 secondes. GitHub Pages lui-même est injoignable depuis l'environnement de GFS : le site de ton dépôt n'a donc pas été vu en
ligne. Si tu ne l'as jamais publié, GFS retombe sur sa copie à chaque ouverture, avec la phrase ci-dessus.

## Pourquoi

Le porteur ne pouvait pas essayer dans GFS ce que les apps poussaient tant que la référence n'avait pas avancé.

## Fait quand

`GFS-ETAT.md` donne « 005 · faite · lue, aucun code » (ajoute la ligne « Demandes à GFS » si ton site n'est pas publié ou si son adresse diffère).
