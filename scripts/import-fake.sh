#!/bin/bash
# Fake CRM import — reads static data/crm-source.json and updates the site catalogues.
set -e
cd "$(dirname "$0")/.."
python3 scripts/sync_crm.py
echo ""
echo "✓ Fake import complete."
echo "  Edit data/crm-source.json to add/change properties, then run this script again."
echo "  Preview: http://localhost:8090"
