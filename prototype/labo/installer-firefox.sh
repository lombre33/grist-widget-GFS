#!/usr/bin/env bash
# Firefox pour test/interfaces-firefox.test.mjs, dans le conteneur du cloud (Linux). conda-forge est joignable depuis le cloud ; les hôtes de Mozilla et de Playwright ne le sont pas, et on ne les contourne pas.
# Une fois par session, environ deux minutes. Écrit le chemin du Firefox posé, que test/firefox.mjs retrouve de lui-même (`~/.cache/gfs-firefox`) ; `GFS_FIREFOX_DIR` change le dossier, et alors
# `GFS_FIREFOX=<ce chemin>` désigne Firefox à l'essai. Sur une autre machine : installe Firefox comme d'habitude (l'essai le trouve dans ses emplacements usuels, ou par `GFS_FIREFOX`).
set -euo pipefail

if [ "$(uname -s)" != "Linux" ]; then echo "Ce script est pour Linux (le cloud) : ailleurs, installe Firefox et, au besoin, GFS_FIREFOX=<fichier exécutable>." >&2; exit 1; fi
case "$(uname -m)" in
  x86_64) PLATFORM=linux-64 ;;
  aarch64 | arm64) PLATFORM=linux-aarch64 ;;
  *) echo "Plateforme non prévue : $(uname -m)" >&2; exit 1 ;;
esac

DIR="${GFS_FIREFOX_DIR:-$HOME/.cache/gfs-firefox}"
BIN="$DIR/root/envs/ff/bin/firefox"
if [ -x "$BIN" ]; then echo "$BIN"; exit 0; fi

mkdir -p "$DIR"
cd "$DIR"
curl -fsSL -o micromamba.tar.bz2 "https://conda.anaconda.org/conda-forge/$PLATFORM/micromamba-2.0.5-0.tar.bz2"
tar -xjf micromamba.tar.bz2 bin/micromamba
MAMBA_ROOT_PREFIX="$DIR/root" ./bin/micromamba create -y -q -n ff -c conda-forge --override-channels firefox
# Le cache des paquets (plus d'un Go) ne sert plus : l'espace du conteneur est compté.
MAMBA_ROOT_PREFIX="$DIR/root" ./bin/micromamba clean -a -y -q
echo "$BIN"
