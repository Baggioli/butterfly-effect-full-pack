#!/usr/bin/env bash
# DRAFT — rsync P1-11 public files to A2. Default dry-run. Requires prior backup.
set -euo pipefail
KEY="${DGX_KEY:-$HOME/.ssh/id_dgx}"
HOST="${DGX_HOST:-lq@spark-864f}"
LOCAL_PUBLIC="${LOCAL_PUBLIC:-/workspace/butterfly-dev/public}"
REMOTE_PUBLIC='~/apps/butterfly-effect-a2/public'
FILES=(coldstart-import.js app.js style.css index.html)
RSYNC_OPTS=(-avz -e "ssh -i $KEY -o BatchMode=yes")
if [[ "${EXECUTE:-}" != "1" ]]; then
  RSYNC_OPTS+=(--dry-run)
  echo "[dry-run] rsync (no write). EXECUTE=1 to apply after backup+order."
fi
for f in "${FILES[@]}"; do
  echo "==> $f"
  rsync "${RSYNC_OPTS[@]}" "$LOCAL_PUBLIC/$f" "$HOST:$REMOTE_PUBLIC/$f"
done
echo "Done. Next: hard refresh + regression-checklist.md"
