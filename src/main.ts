import '@fontsource-variable/figtree'
import './styles/tokens.css'
import './styles/base.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { useTourStore } from './features/onboarding/stores/tour'
import { fromQuery } from './features/race/domain/settings'
import { useRaceStore } from './features/race/stores/race'
import { useSettingsStore } from './features/race/stores/settings'
import { useThemeStore } from './shared/stores/theme'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
useThemeStore(pinia) // starts syncing the saved theme to <html>

// A deep link opens that race day; otherwise start from the last saved settings.
const shared = fromQuery(new URLSearchParams(location.search))
useRaceStore(pinia).newRaceDay(shared ?? useSettingsStore(pinia).settings)

app.mount('#app')

// Fade the splash once the app has painted with its real font, so nothing jumps.
// It stays up for at least one gallop stride after page start, so a fast load doesn't flicker.
const MIN_SPLASH_MS = 500
const stride = new Promise((resolve) => setTimeout(resolve, MIN_SPLASH_MS - performance.now()))
// First-time visitors get the tour once the splash is gone (a modal would sit above it);
// a deep link is someone's race day, so it opens straight to the race.
Promise.all([document.fonts.ready, stride]).then(() => {
  const splash = document.getElementById('splash')
  const ready = () => {
    splash?.remove()
    if (!shared) useTourStore(pinia).startIfNew()
  }
  if (!splash) return ready()
  // transitionend rather than a timer: it follows the real fade, even under a paused test clock.
  splash.addEventListener('transitionend', ready, { once: true })
  splash.classList.add('splash--done')
})
