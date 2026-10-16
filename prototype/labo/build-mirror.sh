#!/usr/bin/env bash
# Miroir local des bibliothèques que Publipostage+ charge depuis des CDN (esm.sh, cdnjs, jsDelivr), pour le labo SEUL : le conteneur du
# cloud n'atteint que le registre npm. On reprend le constructeur de Publipostage+ (dev-tests/.offline-cache : package.json + build.mjs),
# sans rien écrire dans le sous-module : le miroir se construit ici, dans mirror/ (hors Git).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/../apps/publipostage/dev-tests/.offline-cache"
mkdir -p "$HERE/mirror"
cp "$SRC/build.mjs" "$HERE/mirror/build.mjs"
# Seulement ce que l'ouverture d'un document demande : l'éditeur (TipTap, ProseMirror), marked, esbuild. Plotly n'est plus à l'app (le graphique est une
# extension, sa bibliothèque est à GFS) : lab-common.mjs sert la copie de GFS à l'adresse du CDN du catalogue.
python3 - "$SRC/package.json" "$HERE/mirror/package.json" <<'PY'
import json, sys
src = json.load(open(sys.argv[1]))
keep = lambda n: n.startswith(('prosemirror', '@tiptap', '@floating-ui', '@handlewithcare')) or n in (
    'orderedmap', 'rope-sequence', 'w3c-keyname', 'esbuild', 'marked')
src['dependencies'] = {n: v for n, v in src['dependencies'].items() if keep(n)}
json.dump(src, open(sys.argv[2], 'w'), indent=2)
PY
cd "$HERE/mirror"
npm install --no-audit --no-fund --silent
node build.mjs
