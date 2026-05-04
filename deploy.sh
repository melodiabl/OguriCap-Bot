#!/bin/sh
# deploy.sh — build, up -d y limpieza de espacio
set -e

cd "$(dirname "$0")"

echo "🔨 Building..."
docker compose build --no-cache

echo "🚀 Starting..."
docker compose up -d

echo "🧹 Cleaning unused images/layers..."
docker image prune -f
docker builder prune -f

echo "✅ Done"
docker compose ps
