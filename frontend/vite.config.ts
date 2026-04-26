import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

function getPackageName(id: string): string | null {
  const normalized = id.split('node_modules/')[1]
  if (!normalized) {
    return null
  }

  const parts = normalized.split('/')
  if (parts[0].startsWith('@') && parts[1]) {
    return `${parts[0]}/${parts[1]}`
  }

  return parts[0] || null
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          const packageName = getPackageName(id)
          if (!packageName) {
            return undefined
          }

          const isMarkdownPackage = (
            packageName === 'react-markdown'
            || packageName.startsWith('remark-')
            || packageName.startsWith('rehype-')
            || packageName === 'unified'
            || packageName.startsWith('micromark')
            || packageName.startsWith('mdast-')
            || packageName.startsWith('hast-')
            || packageName.startsWith('unist-')
            || packageName.startsWith('vfile')
            || [
              'property-information',
              'space-separated-tokens',
              'comma-separated-tokens',
              'html-url-attributes',
              'is-plain-obj',
              'trim-lines',
              'longest-streak',
              'ccount',
              'decode-named-character-reference',
              'bail',
              'devlop',
              'trough',
              'zwitch',
            ].includes(packageName)
          )

          if ([
            'react',
            'react-dom',
            'scheduler',
          ].includes(packageName)) {
            return 'vendor-react'
          }

          if ([
            'react-router',
            'react-router-dom',
            '@remix-run/router',
          ].includes(packageName)) {
            return 'vendor-router'
          }

          if (isMarkdownPackage) {
            return 'vendor-markdown'
          }

          if ([
            'axios',
            'dayjs',
            'zustand',
            '@babel/runtime',
          ].includes(packageName)) {
            return 'vendor-app'
          }

          return 'vendor-misc'
        },
      },
    },
  },
})
