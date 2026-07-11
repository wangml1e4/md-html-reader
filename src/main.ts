import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles/main.css'

if (import.meta.env.MODE === 'e2e') {
  void import('@wdio/tauri-plugin')
}

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.mount('#app')
