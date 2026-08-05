#!/bin/bash
set -e  # stop immediately if any step fails, instead of continuing on a broken state

cd /var/www/HR-Forms

echo "Pulling latest source..."
git pull

echo "Building frontend..."
cd frontend
npm install
npm run build

echo "Restarting hr-frontend..."
pm2 restart hr-frontend

echo "Done. Deployed frontend from latest main branch."
