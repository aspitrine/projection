#!/usr/bin/env bash
# Prépare Garage pour le développement : disposition du cluster, bucket et clé d'accès.
# Idempotent : relancer le script ne casse rien. Affiche les variables à copier dans apps/web/.env.
set -euo pipefail

bucket="${S3_BUCKET:-projection}"
key_name="${S3_KEY_NAME:-projection-dev}"
garage() { docker compose exec -T garage /garage "$@"; }

echo "Attente de Garage…"
for _ in $(seq 1 30); do
  if garage status >/dev/null 2>&1; then break; fi
  sleep 1
done

node_id=$(garage node id -q | cut -d@ -f1)

# Disposition : une seule zone, un seul nœud.
if ! garage layout show | grep -q "CURRENT CLUSTER LAYOUT" -A 3 | grep -q "$node_id"; then
  garage layout assign -z dc1 -c 5G "$node_id" >/dev/null 2>&1 || true
  current=$(garage layout show | sed -n 's/^Current cluster layout version: *\([0-9]*\).*/\1/p' | tail -1)
  garage layout apply --version "$(( ${current:-0} + 1 ))" >/dev/null
fi

garage bucket create "$bucket" 2>/dev/null || true

if ! garage key list | grep -q "$key_name"; then
  garage key create "$key_name" >/dev/null
fi
# `--owner` autorise aussi la configuration du bucket (règles CORS).
garage bucket allow --read --write --owner "$bucket" --key "$key_name" >/dev/null

info=$(garage key info "$key_name" --show-secret)
access_key=$(echo "$info" | sed -n 's/^Key ID: *//p')
secret_key=$(echo "$info" | sed -n 's/^Secret key: *//p')

cat <<ENV

Ajoutez ces lignes à apps/web/.env :

S3_ENDPOINT=http://localhost:${GARAGE_S3_PORT:-3900}
S3_REGION=garage
S3_BUCKET=$bucket
S3_ACCESS_KEY_ID=$access_key
S3_SECRET_ACCESS_KEY=$secret_key

Puis autorisez le navigateur à téléverser : bun run storage:cors
ENV
