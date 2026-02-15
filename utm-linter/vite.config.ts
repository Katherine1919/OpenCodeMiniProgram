import { defineConfig } from 'vite';
import { resolve } from 'path';

// Build content script separately with IIFE format
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        content: resolve(__dirname, 'src/content/index.ts'),
      },
      output: {
        entryFileNames: 'content/index.js',
        format: 'iife',
        inlineDynamicImports: true,
      },
    },
  },
  plugins: [
    {
      name: 'post-build-background-popup',
      closeBundle: async () => {
        // Build background and popup separately
        const { build } = await import('vite');
        await build({
          configFile: false,
          build: {
            outDir: 'dist',
            emptyOutDir: false,
            rollupOptions: {
              input: {
                background: resolve(__dirname, 'src/background/index.ts'),
                popup: resolve(__dirname, 'src/popup/index.html'),
              },
              output: {
                entryFileNames: (chunkInfo) => {
                  // Put popup files directly in dist/popup/, not dist/src/popup/
                  if (chunkInfo.name === 'popup') {
                    return 'popup/index.js';
                  }
                  return '[name]/index.js';
                },
                format: 'es',
              },
            },
          },
          publicDir: false,
        });
      },
    },
  ],
  publicDir: 'public',
});
