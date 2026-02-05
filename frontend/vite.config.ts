import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const envDir = path.resolve(__dirname, '..');
    const env = loadEnv(mode, envDir, '');
    const supabaseTarget = (env.VITE_SUPABASE_URL || '').trim().replace(/\/+$/, '');
    const enableSupabaseDevProxy =
      mode === 'development' &&
      !!supabaseTarget &&
      String(env.VITE_SUPABASE_DEV_PROXY || '1') === '1';

    return {
      envDir,
      server: {
        port: 3000,
        host: '0.0.0.0',
        cors: enableSupabaseDevProxy
          ? {
              origin: true,
              methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
              allowedHeaders: ['authorization', 'apikey', 'content-type', 'x-client-info'],
              exposedHeaders: ['content-range', 'content-location'],
            }
          : true,
        headers: {
          'Cache-Control': 'no-store',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
        hmr: {
          overlay: true,
          timeout: 600000,
        },
        proxy: enableSupabaseDevProxy
          ? {
              '/rest/v1': {
                target: supabaseTarget,
                changeOrigin: true,
                secure: false,
              },
              '/auth/v1': {
                target: supabaseTarget,
                changeOrigin: true,
                secure: false,
              },
              '/storage/v1': {
                target: supabaseTarget,
                changeOrigin: true,
                secure: false,
              },
              '/functions/v1': {
                target: supabaseTarget,
                changeOrigin: true,
                secure: false,
              },
              '/realtime/v1': {
                target: supabaseTarget,
                changeOrigin: true,
                secure: false,
                ws: true,
              },
            }
          : undefined,
      },
      optimizeDeps: {
        include: ['react', 'react-dom'],
      },
      plugins: [react(), tailwindcss()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || '')
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, 'src'),
          '@/components': path.resolve(__dirname, 'src/components'),
          '@/pages': path.resolve(__dirname, 'src/pages'),
          '@/services': path.resolve(__dirname, 'src/services'),
          '@/hooks': path.resolve(__dirname, 'src/hooks'),
          '@/layouts': path.resolve(__dirname, 'src/layouts'),
          '@/utils': path.resolve(__dirname, 'src/utils'),
          '@/types': path.resolve(__dirname, 'src/types'),
          '@/contexts': path.resolve(__dirname, 'src/contexts'),
          '@/routes': path.resolve(__dirname, 'src/routes'),
          '@/constants': path.resolve(__dirname, 'src/constants'),
          '@/styles': path.resolve(__dirname, 'src/styles'),
          '@/assets': path.resolve(__dirname, 'src/assets'),
        }
      }
    };
});
