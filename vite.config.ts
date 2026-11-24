import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 3000,
    proxy: { '/api': process.env.JRA_API_TARGET || 'http://127.0.0.1:8000' },
  },
  preview: { host: '127.0.0.1', port: 3000 },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: true,
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'three-vendor', test: /node_modules[\\/](?:three|@react-three)[\\/]/, priority: 20 },
            { name: 'chart-vendor', test: /node_modules[\\/](?:recharts|d3-[^/\\]+)[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
});
