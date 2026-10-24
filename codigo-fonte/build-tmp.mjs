import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['server.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  sourcemap: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  outfile: 'dist/server.cjs',
});
console.log('server.cjs ok');
