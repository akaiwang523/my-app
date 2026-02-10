import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/my-app/', // 名字要跟你的 GitHub 專案名稱一樣
  plugins: [react()],
})