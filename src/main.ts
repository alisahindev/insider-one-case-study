import '@fontsource-variable/archivo/wdth.css'
import './styles/tokens.css'
import './styles/base.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { useRaceStore } from './features/race/stores/race'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)

// `?seed=123456` replays a shared race day. URL input is untrusted, so accept digits only.
const seedParam = new URLSearchParams(location.search).get('seed')
if (seedParam && /^\d{1,6}$/.test(seedParam)) useRaceStore(pinia).setSeed(Number(seedParam))

app.mount('#app')
