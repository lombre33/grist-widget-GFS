#!/usr/bin/env bash
# Un VRAI serveur Grist (l'image officielle, à la version de l'instance du porteur) sur 127.0.0.1:8484, pour les essais qui dépendent du serveur : l'API REST, les jetons
# (`getAccessToken`), le CORS, les pièces jointes, la taille d'un envoi. grist-static n'a rien de cela, et un répondeur écrit par nous ne dit que ce que nous y avons mis.
# Il faut Docker. Dans le conteneur du cloud, le démon n'est pas lancé : ce script le lance (sans réseau de pont, ce que le conteneur n'accepte pas).
#   bash vrai-serveur.sh                 # puis : REPO_DIR="$(realpath ../..)" node run-reel-serveur.mjs
#   GRIST_VERSION=1.7.19 GRIST_PORT=8484 bash vrai-serveur.sh
#   GRIST_DOCKER_ARGS="-e ALLOWED_WEBHOOK_DOMAINS=*" bash vrai-serveur.sh   # des réglages de plus pour le serveur (ici : des webhooks vers 127.0.0.1, run-sync-webhook.mjs et run-sync-rest.mjs)
#   GRIST_EMAIL=editor@example.com bash vrai-serveur.sh   # la personne d'essai du moment (le serveur n'en connaît qu'une) : les essais de droits relancent le serveur sous chaque compte (run-droits-reel.mjs)
set -euo pipefail
VERSION="${GRIST_VERSION:-1.7.19}"
PORT="${GRIST_PORT:-8484}"
EMAIL="${GRIST_EMAIL:-essai@example.com}"
HOME_URL="http://127.0.0.1:${PORT}"

if ! docker info >/dev/null 2>&1; then
  (cd /tmp && nohup dockerd --iptables=false --ip-forward=false --bridge=none --storage-driver=overlay2 > /tmp/dockerd.log 2>&1 &)
  for _ in $(seq 1 30); do docker info >/dev/null 2>&1 && break; sleep 1; done
fi

# GRIST_IN_SERVICE : sans lui, Grist demande d'abord sa configuration (écran /boot). GRIST_FORCE_LOGIN : sans lui, la session est anonyme et ne peut rien envoyer.
# GRIST_SANDBOX_FLAVOR=unsandboxed : pas de bac à sable dans le conteneur d'essai. L'adresse donnée par GRIST_DEFAULT_EMAIL est celle de la personne d'essai.
docker rm -f grist >/dev/null 2>&1 || true
mkdir -p /tmp/grist-persist
docker run -d --name grist --network host \
  -e PORT="${PORT}" -e GRIST_IN_SERVICE=true -e GRIST_FORCE_LOGIN=true -e GRIST_SANDBOX_FLAVOR=unsandboxed \
  -e GRIST_DEFAULT_EMAIL="${EMAIL}" -e APP_HOME_URL="${HOME_URL}" \
  ${GRIST_DOCKER_ARGS:-} \
  -v /tmp/grist-persist:/persist "gristlabs/grist:${VERSION}" >/dev/null

for _ in $(seq 1 40); do
  if [ "$(curl -s --noproxy '*' -o /dev/null -w '%{http_code}' "${HOME_URL}/status")" = 200 ]; then
    echo "Grist ${VERSION} répond sur ${HOME_URL}"
    exit 0
  fi
  sleep 2
done
echo "Grist ne répond pas : voir « docker logs grist »" >&2
exit 1
