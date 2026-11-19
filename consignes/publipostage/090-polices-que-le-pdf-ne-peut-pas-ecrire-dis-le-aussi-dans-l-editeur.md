# 090 · Polices que le PDF ne peut pas écrire : dis-le aussi dans l'éditeur, propose de les changer, et une pastille orange sur « Police »

App : Publipostage+ (`lombre33/publipostageGrist`) · posée le 19/11/2026 · demande du porteur du 19/11 · rien à changer dans GFS
quand : à lire au prochain lot, sans urgence ; une fonction nouvelle (un message, un remplacement, une pastille) ; vaut dans GFS et seule

## Quoi

Aujourd'hui, les polices d'un document que le PDF ne peut pas écrire ne sont dites **qu'à l'export** : la fenêtre « Polices du document » (`js/pdf-font-plan.js`, `review`, qui s'appuie sur `scan`) liste celles qui seront remplacées et par quoi. Dans l'éditeur, le texte importé d'un Word garde sa police ; le PDF en sort avec une autre : **un décalage entre ce que la personne voit et ce qui sort**, appris au dernier moment. Le porteur demande trois choses, dans l'éditeur :

**1. Un message.** Quand le document contient une police que le PDF remplace (la même liste que la fenêtre d'export : `PdfFontPlan.scan` sur le texte du document, en-têtes et pieds compris, comme `review`), un message dit lesquelles et par quoi le PDF les remplace (tes mots `pdfFonts.like`). Il paraît à l'import et à l'ouverture du document, et il se ferme.

**2. Un moyen de les changer, depuis ce message.** Un geste qui remplace une de ces polices par une autre (celle que propose le PDF, ou une de la liste des polices de l'éditeur) dans tout le document d'un coup, en un seul pas de l'historique « Annuler ». Rien n'est remplacé sans ce geste.

**3. Une pastille orange sur le bouton « Police » (`#v2-font-chip`, `js/main-toolbar.js`)**, qui reste tant que le document en contient et s'éteint quand il n'y en a plus (après un remplacement, ou parce que le texte a été supprimé). Elle se calcule sur le contenu à chaque ouverture, pas seulement à l'import. Couleur d'avertissement par les jetons, jamais en dur, contraste de 4,5:1 en clair et en sombre ; l'information ne tient pas à la couleur seule (le `title` du bouton dit le nombre de polices concernées, avec `{n|police|polices}`).

Les polices que l'import a déjà remplacées lui-même (`docx.import.report.fonts`, `odt.import.report.fonts`, `pptx.import.report.fonts`) n'y sont plus : rien à signaler pour elles. Là où la fenêtre d'export demande un choix à la personne (les polices libres et Marianne avec GFS), l'éditeur le dit sans le trancher à sa place : à toi de décider ce qui allume la pastille, et dis-le dans ta page `GFS-ETAT.md`.

Ce que cette consigne ne demande pas : bloquer l'export, ni changer la fenêtre « Polices du document », qui garde son rôle.

## Pourquoi

Le porteur : « pour les polices présentes à l'import qui ne peuvent pas être exportées, le message n'est qu'à l'export : cela crée un décalage entre la vue éditeur et le reste. Possible d'avoir un message également dans l'éditeur, de proposer de les changer dans l'éditeur, et que cela reste en orange en bulle de notification dans le bouton police ? » L'éditeur promet « ce que vous voyez est ce qui sort » ; une police remplacée sans un mot avant l'export rompt cette promesse (c'est le retour du 11/11 d'un agent de l'État, d'où la fenêtre d'export). Dire la chose au moment où le document s'ouvre, et la laisser visible, évite la surprise.

## Fait quand

Un document importé avec une police que le PDF remplace montre le message dans l'éditeur (noms et remplaçante), permet de la remplacer partout en un pas d'historique, et porte la pastille sur « Police » tant qu'il en reste ; la pastille s'éteint après le remplacement et se rallume à la réouverture d'un document qui en contient encore ; le tout en français et en anglais, avec un essai dans `dev-tests/` qui échoue sur le code actuel ; la fenêtre d'export est inchangée ; ta page `GFS-ETAT.md` le dit (une ligne dans « Changements qui touchent GFS » avec la date et le commit, et ta ligne « Consignes » : « 090 · faite » avec le commit). GFS lit le dépôt de ton app (`js/pdf-font-plan.js`, `js/main-toolbar.js`, les textes `pdfFonts.*`), puis passe cette consigne à « faite ».
