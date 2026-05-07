import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
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
          if (id.includes('lucide-react')) return 'vendor-icons';

          return undefined;
        },
      },
    },
  },
});
