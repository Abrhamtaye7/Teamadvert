#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
STAGING_DIR="$ROOT_DIR/.release"
BUNDLE_NAME="teamadvert-release"
TARGET_DIR="$STAGING_DIR/$BUNDLE_NAME"
OUTPUT_TAR="$ROOT_DIR/$BUNDLE_NAME.tar.gz"

rm -rf "$STAGING_DIR"
mkdir -p "$TARGET_DIR/backend" "$TARGET_DIR/frontend"

# Build backend
pushd "$ROOT_DIR/backend" >/dev/null
npm install
npm run build
mkdir -p "$TARGET_DIR/backend"
cp package.json package-lock.json "$TARGET_DIR/backend/"
cp -R dist "$TARGET_DIR/backend/dist"
if [ -d prisma ]; then
  cp -R prisma "$TARGET_DIR/backend/prisma"
fi
if [ -f prisma.config.ts ]; then
  cp prisma.config.ts "$TARGET_DIR/backend/prisma.config.ts"
fi
popd >/dev/null

# Build frontend
pushd "$ROOT_DIR/frontend" >/dev/null
npm install
npm run build
mkdir -p "$TARGET_DIR/frontend"
cp package.json package-lock.json "$TARGET_DIR/frontend/"
cp -R dist "$TARGET_DIR/frontend/dist"
cp -R public "$TARGET_DIR/frontend/public"
popd >/dev/null

# Copy shared package if present
if [ -d "$ROOT_DIR/shared" ]; then
  cp -R "$ROOT_DIR/shared" "$TARGET_DIR/shared"
fi

# Compress artifact
rm -f "$OUTPUT_TAR"
tar -czf "$OUTPUT_TAR" -C "$STAGING_DIR" "$BUNDLE_NAME"
echo "Built bundle at $OUTPUT_TAR"
