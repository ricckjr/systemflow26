import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const envDir = path.resolve(__dirname);
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
      build: {
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('node_modules')) {
                if (id.includes('/react-dom/') || id.includes('\\react-dom\\') || id.includes('/react/') || id.includes('\\react\\') || id.includes('/scheduler/') || id.includes('\\scheduler\\')) return 'vendor-react-core'
                if (id.includes('react-router')) return 'vendor-router'
                if (id.includes('@supabase')) return 'vendor-supabase'
                if (id.includes('jspdf')) return 'vendor-jspdf'
                if (id.includes('html2canvas')) return 'vendor-html2canvas'
                if (id.includes('@hello-pangea/dnd')) return 'vendor-dnd'
                if (id.includes('lucide-react')) return 'vendor-icons'
                if (id.includes('recharts')) return 'vendor-charts'
                if (id.includes('date-fns')) return 'vendor-date'
                if (id.includes('@tanstack/react-query')) return 'vendor-query'
                if (id.includes('emoji-picker-react')) return 'vendor-emoji'
                if (id.includes('@google/genai')) return 'vendor-genai'
                return 'vendor'
              }
              return undefined
            },
          },
        },
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
