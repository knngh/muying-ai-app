"""Pause cache writers, back up current data, merge verified results, and recover."""
from pathlib import Path
import datetime
import json
import os
import shutil
import subprocess
import time
import urllib.request

os.environ['PATH'] = '/opt/muying-runtime/node-v24.22.1-linux-x64/bin:' + os.environ['PATH']
app = Path(__file__).resolve().parent.parent
backup = Path('/www/backups') / (
    'muying-reviewed-content-' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S')
)
backup.mkdir(mode=0o700)
processes = ['muying-api', 'muying-authority-worker', 'muying-knowledge-layout-worker']
items = json.loads(subprocess.check_output(['pm2', 'jlist']))
active = [p['name'] for p in items if p['name'] in processes and p['pm2_env']['status'] == 'online']

try:
    for name in reversed(active):
        subprocess.run(['pm2', 'stop', name], check=True, stdout=subprocess.DEVNULL)
    for name in ['authority-knowledge-cache.json', 'authority-translation-cache.json', 'authority-layout-cache.json']:
        shutil.copy2(app / 'data' / name, backup / name)
    subprocess.run(
        ['node', str(app / 'scripts' / 'apply-authority-quality-batch.cjs')],
        env=dict(os.environ, QUALITY_APPLY_BACKUP=str(backup)),
        check=True,
    )
finally:
    restart_errors = []
    for name in active:
        try:
            subprocess.run(['pm2', 'restart', name], check=True, stdout=subprocess.DEVNULL)
        except subprocess.CalledProcessError:
            restart_errors.append(name)
    if restart_errors:
        raise RuntimeError('Failed to restore processes: ' + ', '.join(restart_errors))

for attempt in range(40):
    try:
        with urllib.request.urlopen('http://127.0.0.1:3000/health', timeout=2) as response:
            if response.status == 200:
                break
    except Exception:
        time.sleep(0.5)
else:
    raise RuntimeError('API did not recover after merging content')
print(json.dumps({'backup': str(backup), 'healthy': True}))
