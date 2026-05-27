import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// When building for Electron, assets must use relative paths (not absolute /)
const isElectron = process.env.ELECTRON === 'true'

export default defineConfig({
  plugins: [react()],
  base: isElectron ? './' : '/',
})
