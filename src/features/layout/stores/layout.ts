import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

export const PANELS = { stable: 'Stable', program: 'Program', results: 'Results' } as const
export type PanelId = keyof typeof PANELS
export type Column = 'left' | 'right'
export type Direction = 'up' | 'down' | 'left' | 'right'
type Layout = Record<Column, PanelId[]>

const STORAGE_KEY = '1nsider:layout'
const DEFAULT_LAYOUT: Layout = { left: ['stable'], right: ['program', 'results'] }

/** Saved layouts are untrusted: accept them only if every panel appears exactly once. */
function load(): Layout {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Layout | null
    const ids = saved ? [...saved.left, ...saved.right].sort() : []
    if (ids.join() === Object.keys(PANELS).sort().join()) return saved!
  } catch {
    // Fall through to the default layout.
  }
  return structuredClone(DEFAULT_LAYOUT)
}

/** Which side column each panel sits in, and in what order. The track stays in the middle. */
export const useLayoutStore = defineStore('layout', () => {
  const columns = ref<Layout>(load())
  const announcement = ref('')
  const isDefault = computed(() => JSON.stringify(columns.value) === JSON.stringify(DEFAULT_LAYOUT))

  watch(
    columns,
    (value) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
      } catch {
        // Layout simply won't survive a reload.
      }
    },
    { deep: true },
  )

  /** Keyboard alternative to dragging: arrows reorder within a column or switch columns. */
  function move(id: PanelId, direction: Direction) {
    const from: Column = columns.value.left.includes(id) ? 'left' : 'right'
    const list = columns.value[from]
    const index = list.indexOf(id)

    if (direction === 'up' || direction === 'down') {
      const target = index + (direction === 'up' ? -1 : 1)
      if (target < 0 || target >= list.length) return
      list.splice(index, 1)
      list.splice(target, 0, id)
    } else {
      const to: Column = direction
      if (to === from) return
      list.splice(index, 1)
      const destination = columns.value[to]
      destination.splice(Math.min(index, destination.length), 0, id)
    }

    const column: Column = columns.value.left.includes(id) ? 'left' : 'right'
    const position = columns.value[column].indexOf(id) + 1
    announcement.value = `${PANELS[id]} panel moved to the ${column} column, position ${position} of ${columns.value[column].length}.`
  }

  function reset() {
    columns.value = structuredClone(DEFAULT_LAYOUT)
    announcement.value = 'Panels are back in their default places.'
  }

  return { columns, announcement, isDefault, move, reset }
})
