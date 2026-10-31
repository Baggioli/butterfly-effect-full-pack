// Thin wrapper — real seeder is seed-income-params.py
import {spawnSync} from 'node:child_process';
const r=spawnSync('python3',['scripts/seed-income-params.py',...process.argv.slice(2)],{stdio:'inherit'});
process.exit(r.status??1);
