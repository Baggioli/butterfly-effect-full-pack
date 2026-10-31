#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
python3 - <<'PYCFG'
from pathlib import Path
import subprocess,json,os
state=Path.home()/'.local/state/butterfly-effect'
state.mkdir(parents=True,exist_ok=True,mode=0o700)
status=json.loads(subprocess.check_output(['tailscale','status','--json']))
before=json.loads(subprocess.check_output(['tailscale','serve','status','--json']))
host=status['Self']['DNSName'].rstrip('.')
owner=status['User'][str(status['Self']['UserID'])]['LoginName']
origin='https://'+host+':8443'
handlers=before.get('Web',{}).get(host+':8443',{}).get('Handlers',{})
if handlers and handlers.get('/',{}).get('Proxy')!='http://127.0.0.1:8790':
    raise SystemExit('Port 8443 already belongs to another application.')
for filename,data in [('mobile.json',{'origin':origin,'ownerLogin':owner}),('serve-before-mobile.json',before)]:
    path=state/filename
    path.write_text(json.dumps(data,indent=2)+'\n')
    os.chmod(path,0o600)
PYCFG
unit="$HOME/.config/systemd/user/butterfly-effect-mobile.service"
if test -e "$unit" && ! grep -q 'Managed by Butterfly Effect mobile access' "$unit"; then
 echo 'An unmanaged mobile service already exists.' >&2; exit 1
fi
cat > "$unit" <<'UNIT'
# Managed by Butterfly Effect mobile access
[Unit]
Description=Butterfly Effect private mobile access
After=network.target
[Service]
Type=simple
WorkingDirectory=%h/apps/butterfly-effect
ExecStart=%h/.nvm/versions/node/v22.23.3/bin/node scripts/mobile-server.mjs
Restart=on-failure
RestartSec=5
UMask=0077
NoNewPrivileges=true
[Install]
WantedBy=default.target
UNIT
systemctl --user daemon-reload
systemctl --user enable --now butterfly-effect-mobile.service
systemctl --user restart butterfly-effect-mobile.service
sudo -n tailscale serve --bg --https=8443 --yes http://127.0.0.1:8790
python3 - <<'PYVERIFY'
from pathlib import Path
import subprocess,json
state=Path.home()/'.local/state/butterfly-effect'
before=json.loads((state/'serve-before-mobile.json').read_text())
after=json.loads(subprocess.check_output(['tailscale','serve','status','--json']))
for section in ['TCP','Web','AllowFunnel']:
    for key,value in before.get(section,{}).items():
        if key.endswith(':8443') or key=='8443':
            continue
        assert after.get(section,{}).get(key)==value,'Existing entry changed: '+section+' '+key
config=json.loads((state/'mobile.json').read_text())
authority=config['origin'].split('://',1)[1]
assert after.get('AllowFunnel',{}).get(authority) is not True,'Mobile entry must remain private'
assert after['Web'][authority]['Handlers']['/']['Proxy']=='http://127.0.0.1:8790'
print('Private mobile URL:',config['origin'])
print('Existing entries preserved; mobile public exposure disabled.')
PYVERIFY
