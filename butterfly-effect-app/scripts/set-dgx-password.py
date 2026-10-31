"""Keep the access password outside source, process arguments and logs."""
import os
from pathlib import Path
import secrets
import sys
import tempfile

folder = Path.home() / '.local/state/butterfly-effect'
folder.mkdir(mode=0o700, parents=True, exist_ok=True)
os.chmod(folder, 0o700)
target = folder / 'password'
if '--stdin' in sys.argv:
    password = sys.stdin.read()
    if not 16 <= len(password) <= 512 or '\n' in password or '\r' in password:
        sys.exit('Password must contain 16–512 characters on one line.')
elif target.exists():
    sys.exit(0)
else:
    password = secrets.token_urlsafe(32)
fd, temporary = tempfile.mkstemp(dir=folder)
try:
    with os.fdopen(fd, 'w') as stream:
        stream.write(password)
    os.replace(temporary, target)
finally:
    if os.path.exists(temporary):
        os.unlink(temporary)
