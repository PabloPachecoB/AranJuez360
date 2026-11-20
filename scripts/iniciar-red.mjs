import { networkInterfaces } from 'node:os';
import { existsSync, readFileSync, writeFileSync, mkdirSync, openSync, closeSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');
const noExpo = process.argv.includes('--no-expo');
const interfaces = Object.entries(networkInterfaces()).flatMap(([name, addresses]) =>
  (addresses || []).filter(a => a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.')
    && !/vmware|virtual|vethernet|loopback|docker|wsl|vpn|tailscale/i.test(name)).map(a => ({ name, ip: a.address })));
const specified = process.argv.find(a => a.startsWith('--ip='))?.slice(5);
const selected = specified ? interfaces.find(a => a.ip === specified) : interfaces.find(a => /wi-?fi|wireless|wlan/i.test(a.name)) || interfaces[0];
if (!selected) {
  console.error('No encuentro una IP de red local. Conecta el equipo al Wi-Fi y vuelve a iniciar.');
  process.exit(1);
}
const ip = selected.ip;
const base = `http://${ip}:8001`;
const owned = [];
let closing = false;
const pause = ms => new Promise(r => setTimeout(r, ms));

function updateEnv(file, key, value) {
  const source = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  const next = pattern.test(source) ? source.replace(pattern, `${key}=${value}`)
    : `${source}${source && !source.endsWith('\n') ? '\n' : ''}${key}=${value}\n`;
  if (next !== source) writeFileSync(file, next, 'utf8');
}
async function response(url) {
  try { return await fetch(url, { signal: AbortSignal.timeout(2000), redirect: 'manual' }); }
  catch { return null; }
}
async function ready(port) {
  const url = `http://${ip}:${port}${port === 8001 ? '/api/v1/auth/procedencias/' : '/'}`;
  const r = await response(url);
  if (!r?.ok) return false;
  if (port === 8001) { try { const data = await r.json(); return Array.isArray(data) && data.some(p => p.valor === 'CERCADO'); } catch { return false; } }
  if (port === 3000) return (await r.text()).includes('/@vite/client');
  const status = await response(`http://${ip}:8081/status`);
  return status?.ok && (await status.text()).includes('packager-status:running');
}
function stop() {
  if (closing) return;
  closing = true;
  for (const child of owned) {
    if (child.exitCode !== null || !child.pid) continue;
    if (process.platform === 'win32') spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    else child.kill('SIGTERM');
  }
}
process.on('SIGINT', () => { stop(); process.exit(0); });
process.on('SIGTERM', () => { stop(); process.exit(0); });
process.on('exit', stop);

function start(name, executable, args, cwd, interactive = false) {
  const folder = join(root, 'tmp', 'inicio-red');
  mkdirSync(folder, { recursive: true });
  const log = interactive ? null : openSync(join(folder, `${name}.log`), 'a');
  const child = spawn(executable, args, {
    cwd, windowsHide: true, stdio: interactive ? 'inherit' : ['ignore', log, log],
    env: { ...process.env, EXPO_PUBLIC_API_BASE: base, REACT_NATIVE_PACKAGER_HOSTNAME: ip,
      VITE_BACKEND_URL: 'http://127.0.0.1:8001' },
  });
  if (log !== null) closeSync(log);
  owned.push(child);
  child.on('error', error => { console.error(`${name}: ${error.message}`); stop(); process.exitCode = 1; });
  child.on('exit', code => {
    if (!closing) { console.error(`${name} se detuvo (${code}). Revisa tmp/inicio-red/${name}.log`); stop(); process.exit(1); }
  });
  return child;
}
async function ensure(name, port, launch) {
  if (await ready(port)) { console.log(`${name}: disponible en la red (se reutiliza).`); return; }
  const local = await response(`http://127.0.0.1:${port}/`);
  if (local) throw Error(`${name}: el puerto ${port} ya está ocupado, pero no responde correctamente por la red. Cierra la terminal que lo inició y vuelve a ejecutar INICIAR.cmd.`);
  if (checkOnly) throw Error(`${name}: apagado o inaccesible en ${ip}:${port}.`);
  console.log(`Iniciando ${name}...`);
  launch();
  for (let n = 0; n < 45; n++) { if (await ready(port)) return; await pause(1000); }
  throw Error(`${name} no quedó disponible. Revisa tmp/inicio-red/${name}.log.`);
}

try {
  console.log(`Red: ${selected.name} (${ip})`);
  if (!checkOnly) {
    const envPath = join(root, 'backend', '.env');
    if (!existsSync(envPath)) throw Error('Falta backend/.env. Configura el backend antes de iniciar.');
    const old = readFileSync(envPath, 'utf8').match(/^ALLOWED_HOSTS=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '') || 'localhost,127.0.0.1';
    updateEnv(envPath, 'ALLOWED_HOSTS', [...new Set([...old.split(',').map(h => h.trim()).filter(Boolean), 'localhost', '127.0.0.1', ip])].join(','));
    updateEnv(join(root, 'app', '.env'), 'EXPO_PUBLIC_API_BASE', base);
    // Sobrescrituras locales de Expo también deben apuntar al servidor que acabamos de comprobar.
    for (const name of ['.env.local', '.env.development', '.env.development.local']) {
      const file = join(root, 'app', name);
      if (existsSync(file) && /^EXPO_PUBLIC_API_BASE=/m.test(readFileSync(file, 'utf8'))) updateEnv(file, 'EXPO_PUBLIC_API_BASE', base);
    }
  }
  await ensure('backend', 8001, () => start('backend', join(root, 'backend', '.venv', 'Scripts', 'python.exe'),
    ['manage.py', 'runserver', '0.0.0.0:8001'], join(root, 'backend')));
  await ensure('web', 3000, () => start('web', process.execPath,
    [join(root, 'web', 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '0.0.0.0', '--port', '3000', '--strictPort'], join(root, 'web')));
  if (!noExpo) await ensure('expo', 8081, () => start('expo', process.execPath,
    [join(root, 'app', 'node_modules', 'expo', 'bin', 'cli'), 'start', '--lan', '--port', '8081', '--clear'], join(root, 'app'), true));
  console.log(`\nWEB: http://${ip}:3000/\nBACKEND: ${base}/api/v1/auth/procedencias/`);
  if (!noExpo) console.log(`EXPO GO: exp://${ip}:8081\nSi Expo ya estaba abierto, recarga la app o vuelve a escanear su QR.`);
  console.log('El celular debe estar conectado a la misma red Wi-Fi.');
  if (owned.length) { console.log('Deja esta ventana abierta. Ctrl+C detiene los servicios iniciados aquí.'); setInterval(() => {}, 1000); }
} catch (error) {
  console.error(error.message);
  stop();
  process.exitCode = 1;
}
