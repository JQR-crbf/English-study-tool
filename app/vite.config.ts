import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 在桌面打包（Electron）场景下，使用相对路径，确保通过 file:// 加载本地 dist 资源
// 其他场景（开发/浏览器部署）保持默认根路径
const isDesktopBuild = process.env.APP_ENV === 'desktop' || process.env.ELECTRON === '1' || process.env.ELECTRON === 'true';

export default defineConfig({
  plugins: [react()],
  base: isDesktopBuild ? './' : '/',
})
