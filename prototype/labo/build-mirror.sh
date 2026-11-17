#!/usr/bin/env bash
# Miroir local des bibliothèques que Publipostage+ charge depuis des CDN (esm.sh, cdnjs, jsDelivr), pour le labo SEUL : le conteneur du
# cloud n'atteint que le registre npm. Depuis la 063 de l'app (82ae542), son miroir se refait par l'outil du kit, d'après la liste unique de son
# package.json (`node kit/outils/bibliotheques.mjs --miroir`) : on lui donne une COPIE de l'app (git archive de la référence de GFS), rien n'est écrit dans le
# sous-module, puis on range ici (mirror/, hors Git) ce que le labo lit : `esm/` (les modules ES), `esm-map.json` et `umd/` (les fichiers UMD).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
APP="$HERE/../apps/publipostage"
KIT="$HERE/../kit"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
git -C "$APP" archive HEAD | tar -x -C "$WORK"
(cd "$WORK" && node "$KIT/outils/bibliotheques.mjs" --miroir --racine "$WORK")
SRC="$WORK/dev-tests/.offline-cache"
rm -rf "$HERE/mirror"
mkdir -p "$HERE/mirror"
cp -r "$SRC/esm" "$SRC/umd" "$SRC/esm-map.json" "$HERE/mirror/"
echo "miroir : $(ls "$HERE/mirror/esm" | wc -l) fichiers ES, $(ls "$HERE/mirror/umd" | wc -l) fichiers UMD dans $HERE/mirror"
