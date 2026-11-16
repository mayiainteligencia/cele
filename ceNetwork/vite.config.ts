import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'dev-entry-swap',
      apply: 'serve',
      transformIndexHtml(html) {
        return html.replace(
          '<script src="./dist/assets/app.js"></script>',
          '<script type="module" src="/src/main.ts"></script>'
        );
      },
    },
  ],
  server: {
    port: 5174,
    host: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: './src/main.ts',
      output: {
        format: 'iife',
        name: 'CeNetworkBundle',
        inlineDynamicImports: true,
        entryFileNames: 'assets/app.js',
        assetFileNames: 'assets/app[extname]',
      },
    },
  },
});




