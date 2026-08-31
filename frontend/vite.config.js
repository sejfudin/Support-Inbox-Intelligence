import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true, ws: true },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      react: path.resolve('./node_modules/react'),
      'react-dom': path.resolve('./node_modules/react-dom'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          if (id.includes('@tiptap')) return 'vendor-tiptap';
          if (id.includes('@tanstack')) return 'vendor-tanstack';
          if (id.includes('@radix-ui')) return 'vendor-radix';
          if (id.includes('recharts')) return 'vendor-charts';
          if (id.includes('date-fns')) return 'vendor-date';
          if (id.includes('socket.io-client')) return 'vendor-socket';
          // Brand logos and glyphs together in one chunk. They are the largest thing in the
          // app that almost never changes — `simple-icons` alone is ~130kB of path data for
          // the technology catalog's marks — so keeping them out of the main chunk means a
          // deploy does not re-download them.
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('developer-icons')) return 'vendor-icons';
          if (id.includes('simple-icons')) return 'vendor-icons';

          return undefined;
        },
      },
    },
  },
});
