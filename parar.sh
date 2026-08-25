#!/usr/bin/env bash
#
# parar.sh — Para todos os serviços sem perder dados persistidos
#
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Parando containers do ambiente NoSQL..."

if docker info >/dev/null 2>&1; then
    docker compose down
elif sg docker -c "docker info" >/dev/null 2>&1; then
    sg docker -c "docker compose down"
else
    sudo docker compose down
fi

echo "Containers parados com sucesso. Seus dados continuam salvos nos volumes."
