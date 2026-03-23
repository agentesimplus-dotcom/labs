import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const packageJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    define: {
        __APP_VERSION__: JSON.stringify(packageJson.version),
    },
    build: {
        outDir: 'dist',
        sourcemap: false
    },
    preview: {
        port: 8000,
        host: '0.0.0.0'
    }
})
