#!/usr/bin/env bash

set -e

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "[NanKe] Checking runtime..."
if ! command -v node >/dev/null 2>&1; then
    echo "[NanKe] Node.js was not found."
    echo "[NanKe] Please install Node.js and run this script again."
    exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
    if ! command -v corepack >/dev/null 2>&1; then
        echo "[NanKe] pnpm and Corepack were not found."
        echo "[NanKe] Please install pnpm 11.5.1 and run this script again."
        exit 1
    fi

    echo "[NanKe] Enabling pnpm 11.5.1..."
    corepack prepare pnpm@11.5.1 --activate
fi

echo "[NanKe] Installing dependencies..."
pnpm install --frozen-lockfile

echo "[NanKe] Starting http://127.0.0.1:5173 ..."
exec pnpm dev --host 127.0.0.1 --open
