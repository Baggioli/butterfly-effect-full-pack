#!/usr/bin/env bash
# DRAFT — backup A2 on DGX. Refuses unless EXECUTE=1.
set -euo pipefail
KEY="${DGX_KEY:-$HOME/.ssh/id_dgx}"
HOST="${DGX_HOST:-lq@spark-864f}"
REMOTE_APP='~/apps/butterfly-effect-a2'
if [[ "${EXECUTE:-}" != "1" ]]; then
  echo "[dry-run] would: ssh -i $KEY $HOST \"cp -a $REMOTE_APP ${REMOTE_APP}.bak-p1-11-\$(date +%Y%m%d-%H%M%S)\""
  echo "Set EXECUTE=1 to run for real (only after product/parent order)."
  exit 0
fi
ssh -i "$KEY" -o BatchMode=yes -o StrictHostKeyChecking=yes "$HOST" \
  "ts=\$(date +%Y%m%d-%H%M%S); cp -a $REMOTE_APP ${REMOTE_APP}.bak-p1-11-\$ts && echo BAK=\$ts && ls -ld ${REMOTE_APP}.bak-p1-11-\$ts"
