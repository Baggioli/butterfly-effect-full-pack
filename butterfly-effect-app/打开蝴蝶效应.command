#!/bin/zsh
set -euo pipefail
cd "${0:A:h}"
domain="gui/$(id -u)"
for label in com.lq.butterfly-effect.tunnel com.lq.butterfly-effect.dev; do
  if ! launchctl print "$domain/$label" >/dev/null 2>&1; then
    launchctl bootstrap "$domain" "$HOME/Library/LaunchAgents/$label.plist"
  fi
  launchctl kickstart "$domain/$label"
done
for attempt in {1..25}; do
  if [[ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:4173 || true)" == 200 ]]; then
    open http://127.0.0.1:4173
    exit 0
  fi
  sleep 1
done
echo '本机服务暂未就绪，请稍后重试。'
exit 1
