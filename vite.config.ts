import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isDesktopBuild = env.VITE_DESKTOP === 'true' || process.env.VITE_DESKTOP === 'true';

  return {
    plugins: [react()],

    // Electron loads the built HTML from the filesystem — must use relative paths
    base: isDesktopBuild ? './' : '/',

    define: {
      __DESKTOP__: JSON.stringify(isDesktopBuild)
    },

    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true
        },
        '/ws': {
          target: 'ws://localhost:3000',
          ws: true,
          changeOrigin: true
        }
      }
    },

    build: {
      outDir: 'dist',
      emptyOutDir: true,
      // Slightly larger chunk limit for Electron (no CDN concerns)
      chunkSizeWarningLimit: isDesktopBuild ? 2000 : 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-mui': ['@mui/material', '@mui/icons-material'],
            'vendor-query': ['@tanstack/react-query'],
            'vendor-charts': ['recharts']
          }
        }
      }
    }
  };
});
