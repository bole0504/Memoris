import esbuild from 'esbuild';

const production = process.argv.includes('production');

const ctx = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node', // Obsidian desktop runs in Electron; node builtins (http) are available.
  target: 'es2020',
  // Obsidian + Electron + node builtins are provided at runtime.
  external: ['obsidian', 'electron', '@electron/remote', '@codemirror/*', 'node:*'],
  outfile: 'main.js',
  sourcemap: production ? false : 'inline',
  minify: production,
  logLevel: 'info',
});

if (production) {
  await ctx.rebuild();
  await ctx.dispose();
} else {
  await ctx.watch();
}
