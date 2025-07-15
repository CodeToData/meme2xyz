import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc' // Faster than regular React plugin

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Enable hardware acceleration
    hmr: {
      overlay: false
    }
  },
  build: {
    // Use esbuild for faster builds
    minify: 'esbuild',
    target: 'esnext',
    // Enable parallel processing
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom']
        }
      }
    }
  },
  optimizeDeps: {
    // Pre-bundle dependencies for faster startup
    include: ['react', 'react-dom']
  }
})
