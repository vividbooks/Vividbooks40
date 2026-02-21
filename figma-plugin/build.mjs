import esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const watch = process.argv.includes('--watch');

// ── Build code.ts (plugin sandbox) ──────────────────────────────────────────
const sandboxCtx = await esbuild.context({
  entryPoints: ['src/code.ts'],
  bundle: true,
  outfile: 'dist/code.js',
  platform: 'browser',
  target: 'es2017',
  logLevel: 'info',
});

// ── Build ui.ts (iframe UI) ──────────────────────────────────────────────────
const uiCtx = await esbuild.context({
  entryPoints: ['src/ui.ts'],
  bundle: true,
  outfile: 'dist/ui-bundle.js',
  platform: 'browser',
  target: 'es2017',
  logLevel: 'info',
});

await sandboxCtx.rebuild();
await uiCtx.rebuild();

// Inline the JS bundle into ui.html
function buildUiHtml() {
  const template = fs.readFileSync('src/ui.html', 'utf8');
  const bundle = fs.readFileSync('dist/ui-bundle.js', 'utf8');
  const html = template.replace('<!-- __BUNDLE__ -->', `<script>${bundle}</script>`);
  fs.mkdirSync('dist', { recursive: true });
  fs.writeFileSync('dist/ui.html', html);
  console.log('[ui.html] written to dist/ui.html');
}

buildUiHtml();

if (watch) {
  console.log('Watching for changes...');
  const rebuild = async () => {
    await sandboxCtx.rebuild();
    await uiCtx.rebuild();
    buildUiHtml();
  };
  // Simple polling watcher
  let lastMtime = {};
  const srcFiles = () => {
    const walk = (dir) => fs.readdirSync(dir).flatMap(f => {
      const p = path.join(dir, f);
      return fs.statSync(p).isDirectory() ? walk(p) : [p];
    });
    return [...walk('src')];
  };
  setInterval(async () => {
    let changed = false;
    for (const f of srcFiles()) {
      const mtime = fs.statSync(f).mtimeMs;
      if (lastMtime[f] !== mtime) { lastMtime[f] = mtime; changed = true; }
    }
    if (changed) await rebuild();
  }, 500);
} else {
  await sandboxCtx.dispose();
  await uiCtx.dispose();
}
