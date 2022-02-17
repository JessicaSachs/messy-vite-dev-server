import { defineConfig } from 'cypress'
import { devServer } from '@cypress/vite-dev-server'

export default defineConfig({
  // Component testing, TypeScript, Vue.js, Vite
  component: {
    devServer,
    devServerConfig: {}
  },
})
