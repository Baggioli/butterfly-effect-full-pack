#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
test "$PWD" = "$HOME/apps/butterfly-effect"
test -x "$HOME/.nvm/versions/node/v22.23.3/bin/node"
python3 scripts/set-dgx-password.py
mkdir -p "$HOME/.config/systemd/user"
unit="$HOME/.config/systemd/user/butterfly-effect.service"
if test -e "$unit" && ! grep -q 'Managed by Butterfly Effect local deployment' "$unit"; then
  echo 'An unmanaged service with this name already exists.' >&2
  exit 1
fi
cat > "$unit" <<'UNIT'
# Managed by Butterfly Effect local deployment
[Unit]
Description=Butterfly Effect private DGX application
After=network.target

[Service]
Type=simple
WorkingDirectory=%h/apps/butterfly-effect
ExecStart=%h/.nvm/versions/node/v22.23.3/bin/node scripts/dgx-server.mjs
Environment=AI_MODEL=qwen2.5:32b
Environment=DGX_APP_PASSWORD_FILE=%h/.local/state/butterfly-effect/password
Restart=on-failure
RestartSec=5
UMask=0077
NoNewPrivileges=true

[Install]
WantedBy=default.target
UNIT
systemctl --user daemon-reload
systemctl --user enable --now butterfly-effect.service
systemctl --user is-active butterfly-effect.service
