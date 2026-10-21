# 002 · Démarrer la liaison : quoi lire, quoi faire, ce qui vient

App : Form+ · posée le 21/10/2026 · à la demande du porteur, pour que ton projet démarre la liaison avec GFS · quand : à
lire avec la 001, avant le prochain lot ; aucun code à changer ; sans effet dans l'app seule

## Quoi

**1. Lire, dans cet ordre.** Le dépôt de GFS est public (`git clone --depth 1 https://github.com/lombre33/grist-widget-GFS`,
branche `main`) : on y lit, on n'y pousse jamais.

1. `docs/gfs-en-bref.md` : GFS en une page, ce qui est en jeu, ce qui change pour une app, qui fait quoi.
2. `consignes/LISEZ-MOI.md` : la boîte aux lettres. GFS t'écrit dans `consignes/form/` ; tu lui réponds par un `GFS-ETAT.md`
   à la racine de ton dépôt, dont le format y est écrit. Chaque côté ne lit qu'une page : toi, `consignes/form/INDEX.md` ;
   GFS, ton `GFS-ETAT.md`.
3. `consignes/form/INDEX.md`, puis seulement les consignes « à faire » : la 001, puis celle-ci.
4. `docs/guide-des-apps.md`, sections 1.1 (treize règles) et 3 (ta ligne) : c'est la 001. Le cahier (« En bref », 4.5 le
   kit, 10 le plan) et `docs/contrats.md` se lisent quand une consigne y renvoie, pas avant.

**2. Faire, dans cet ordre.**

1. **La 001**, telle qu'elle est écrite : c'est elle qui crée ton `GFS-ETAT.md`. Tant que cette page n'existe pas, GFS ne
   sait pas où tu en es.
2. **Une correction à lire dans ta ligne du guide** (point 4 de la 001) : le relevé du 14/10 citait deux tables internes de
   Grist écrites par ton code, `_grist_Views_section` et `_grist_Views_section_field` ; il en manquait une troisième,
   `_grist_Tables_column` (la colonne affichée, `visibleCol` : `poc/js/grist-meta.js`, ligne 132 à `b073d03`). GFS a
   complété le guide le 21/10. Depuis `c1237a2`, une question « Liste de références » ajoute aussi une colonne cachée à la
   table du formulaire (`FormPlus_srcL_…`, `ensureRefListField`), comme `FormPlus_src_…` pour un choix, avec la même
   écriture de `visibleCol`. C'est du code nouveau : la règle 8 (aucune écriture dans une table interne `_grist_*` sans une
   raison écrite) veut sa raison, et ton état est l'endroit pour la dire ; celles du code plus ancien se justifient à
   l'étape 5.
3. **Poser tes questions** dans « Questions pour GFS » du `GFS-ETAT.md`, une ligne chacune ; GFS répond par une consigne.
   Une question urgente se dit aussi au porteur, dans ton projet.

**3. Ce qui vient** (une annonce : rien à faire maintenant).

1. **Le kit commun v0** (étape 3 du plan, cahier 10) : Form+ en est le premier client (choix du porteur, 16/10 ; cahier
   4.5). À la place de ce que le relevé du 14/10 a trouvé chez toi (les fenêtres `prompt` et `confirm` du navigateur, une
   palette à toi, le français seul), il t'apporte les fenêtres, la traduction français / anglais, le thème et les jetons de
   la charte. Une consigne séparée de GFS donnera l'étiquette du kit et dira comment le référencer. D'ici là, n'écris pas de
   nouvelle copie de ces fonctions (règle 1 : en attendant le kit, on le note, on ne le copie pas).
2. **Ensuite**, chaque pas avec le go du porteur et dans une consigne à part : la liste des bibliothèques (étape 4), puis
   « apps prêtes pour GFS » (étape 5 : ta définition dans une table préfixée, tes écritures `_grist_*` déclarées ou retirées,
   le contexte par le kit, `gfs.json`). Le « premier pas » de ta ligne du guide est de ces pas-là : ne l'engage pas avant
   (001, point 3).

## Pourquoi

1. Ton projet commence la liaison : la 001 date du 14/10 et n'a pas encore de réponse, et la boîte aux lettres s'apprend en
   la pratiquant. Cette page donne l'ordre, pour qu'aucun pas ne soit fait avant son tour.
2. Le porteur a demandé le 21/10 que GFS donne à Form+ de quoi démarrer.
3. Form+ est le premier client du kit : des fenêtres, une traduction ou un thème écrits maintenant seraient à refaire à
   l'étape 3 (cahier 4.5).

## Fait quand

`GFS-ETAT.md` donne « 002 · faite · lue » quand tu as lu cette page et fait la 001 ; aucun code n'est demandé ici. Ce qui
t'arrête ou t'étonne dans la boîte aux lettres elle-même (un chemin, un format, un mot) va dans « Questions pour GFS ».
