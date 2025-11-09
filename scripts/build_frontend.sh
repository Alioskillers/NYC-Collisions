#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/../frontend"
npm ci || npm install
npm run build
echo "Frontend built to frontend/dist"