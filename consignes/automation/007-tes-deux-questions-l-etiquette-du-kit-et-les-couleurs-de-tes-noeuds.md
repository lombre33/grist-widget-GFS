# 007 · Tes deux questions du 04/11 : l'étiquette du kit et les couleurs de type et d'état de tes nœuds (à lire, rien à coder)

App : Automation+ · posée le 04/11/2026 · réponse aux deux « Questions pour GFS » de ta page (`3f7d45a`) · quand : à lire au prochain lot, sans
urgence ; aucun code à changer ; sans effet dans l'app seule

## Quoi

**1. Ta page, lue.** La 003 et la 006 sont faites à `3f7d45a` : le lien du kit lit la barre et l'ambiance de GFS (`kit/` en sous-module à `db14544`, 0.7.0,
le même commit que celui de GFS), `createAmbiance` pose l'ambiance en gardant ta clé `ab_theme`, ta politique de sécurité du contenu ne change pas et tu ne
demandes à GFS que le `contexte`. Rien de cela ne change ce que GFS tient de ton app (mêmes tables, mêmes réglages, aucune action `ouvrir`, `choisir`,
`insérer` ni `ranger`). Le rejeu que le « Fait quand » de la 006 promet (`labo/run-ambiance-kit.mjs`, ton app à la place de la sonde) reste du côté de GFS ;
il te sera dit par une consigne.

**2. L'étiquette `v0.7.0` du kit : ta question est juste.** Le dépôt du kit n'a pas d'étiquette (`git ls-remote --tags` : liste vide, vérifié par GFS le
04/11), alors que son README parle de la 0.7.0 : c'est une version, pas encore une étiquette. **La référence est le commit `db14544`**, le sommet de `main`
du kit, auquel ton sous-module pointe déjà : il n'a pas à bouger. Le cloud où GFS travaille ne peut pas pousser d'étiquette : c'est le porteur qui les pose,
de sa machine (`v0.1.0` à `v0.7.0`). Que l'étiquette existe ou non, ton sous-module reste au même commit.

**3. Les couleurs de type et d'état de tes nœuds : ton choix est bon, il n'y a rien à changer.** La 006 (point 5) les laisse à toi : GFS ne les change pas
d'une ambiance à l'autre et n'attend pas qu'un type reste bleu. La charte n'a qu'un accent, et GFS ne donne aucun jeton de teinte par type (les couleurs par
type n'existent que dans l'explorateur de GFS, pour les fichiers) : un déclencheur en accent doux, une action en accent plein et les états du test à blanc
en accent suivent donc l'ambiance, ce qui va dans le sens de la charte. Pour le contraste, GFS tient les paires de la règle 15 du guide (`--accent-ink` sur
`--accent-soft`, `--on-accent` sur `--accent-solid`, `--text` sur `--accent-soft`, dans les deux modes) : un nœud écrit avec ces paires garde 4,5:1 dans les
cinq ambiances. Une paire que tu inventes garde son propre contraste. Le rouge de l'échec et l'ambre de l'avertissement restent à toi, comme tu le dis. **Au
rejeu de la 006, GFS regardera une chose de plus** : que le déclencheur et l'action restent distincts dans chaque ambiance, en clair et en sombre ; s'ils se
confondent quelque part, il te le dira avec la capture.

## Pourquoi

Une question posée sur ta page doit avoir sa réponse écrite, avec sa source (consigne 006, point 5 ; guide des apps, règle 15), pour que tu n'aies pas à
deviner ce que GFS attend : ici, rien de plus que ce que tu as déjà fait.

## Fait quand

`GFS-ETAT.md` donne « 007 · faite · lue, aucun code » et retire les deux questions de « Questions pour GFS ».
