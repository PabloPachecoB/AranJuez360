// Desde la raíz: node app/preview/jarvis/build.mjs [--serve]
// Usa Vite ya instalado en web; no modifica las dependencias de Expo.
import { build, preview } from '../../../web/node_modules/vite/dist/node/index.js';
import babel from '../../node_modules/@babel/core/lib/index.js';
import jsx from '../../node_modules/@babel/plugin-transform-react-jsx/lib/index.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(fileURLToPath(import.meta.url));
const app = path.resolve(root, '../..');
const config = { root, configFile: false, resolve: { alias: [
  { find: /^react-native$/, replacement: path.join(app, 'node_modules/react-native-web') },
  { find: /^react$/, replacement: path.join(app, 'node_modules/react') },
  { find: /^react\//, replacement: path.join(app, 'node_modules/react') + '/' },
  { find: /^react-dom\//, replacement: path.join(app, 'node_modules/react-dom') + '/' },
] }, plugins: [{ name: 'jsx-components', enforce: 'pre', transform(code, id) {
  if (id.replaceAll('\\', '/').includes('/components/') && id.endsWith('.js'))
    return babel.transformSync(code, { configFile: false, babelrc: false, plugins: [[jsx, { runtime: 'automatic' }]] });
} }], build: { outDir: path.join(app, 'node_modules/.cache/jarvis-preview/dist'), emptyOutDir: true },
define: { global: 'globalThis', 'process.env.NODE_ENV': '"production"' } };
await build(config);
if (process.argv.includes('--serve')) {
  const server = await preview({ ...config, preview: { host: '127.0.0.1', port: 4317, strictPort: true } });
  server.printUrls();
}
