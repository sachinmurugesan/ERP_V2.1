import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primevue/themes/aura'

import App from './App.vue'
import router from './router'
import './style.css'

const app = createApp(App)

// State management
app.use(createPinia())

// Router
app.use(router)

// PrimeVue UI library
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: false,
    }
  }
})

app.mount('#app')
