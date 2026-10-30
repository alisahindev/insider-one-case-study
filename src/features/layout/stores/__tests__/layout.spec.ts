import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { PANELS, useLayoutStore } from '../layout'

const KEY = '1nsider:layout'
const DEFAULT = { left: ['stable'], right: ['program', 'results'] }

/** A fresh store as on a new visit, reading whatever is in storage now. */
function reload() {
  setActivePinia(createPinia())
  return useLayoutStore()
}

function saved() {
  return JSON.parse(localStorage.getItem(KEY) ?? 'null')
}

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('layout store', () => {
  it('names the three side panels', () => {
    expect(PANELS).toEqual({ stable: 'Stable', program: 'Program', results: 'Results' })
  })

  it('starts with the stable on the left and program above results on the right', () => {
    const layout = useLayoutStore()
    expect(layout.columns).toEqual(DEFAULT)
    expect(layout.isDefault).toBe(true)
    expect(layout.announcement).toBe('')
  })

  describe('loading a saved layout', () => {
    it.each([
      { left: ['results', 'stable'], right: ['program'] },
      { left: [], right: ['stable', 'program', 'results'] },
      { left: ['program', 'results', 'stable'], right: [] },
    ])('restores %j', (layout) => {
      localStorage.setItem(KEY, JSON.stringify(layout))
      expect(reload().columns).toEqual(layout)
    })

    it('reports a restored custom layout as not the default', () => {
      localStorage.setItem(
        KEY,
        JSON.stringify({ left: [], right: ['stable', 'program', 'results'] }),
      )
      expect(reload().isDefault).toBe(false)
    })

    it.each([
      ['corrupted JSON', '{left:'],
      ['null', 'null'],
      ['a number', '5'],
      ['an array', '[]'],
      ['an object without columns', '{}'],
      [
        'a column that is not a list',
        JSON.stringify({ left: 'stable', right: ['program', 'results'] }),
      ],
      ['a missing panel', JSON.stringify({ left: ['stable'], right: ['program'] })],
      ['a duplicated panel', JSON.stringify({ left: ['stable', 'program'], right: ['program'] })],
      [
        'an unknown panel',
        JSON.stringify({ left: ['stable', 'chat'], right: ['program', 'results'] }),
      ],
      [
        'an extra panel',
        JSON.stringify({ left: ['stable', 'stable'], right: ['program', 'results'] }),
      ],
    ])('falls back to the default layout for %s', (_, value) => {
      localStorage.setItem(KEY, value)
      expect(reload().columns).toEqual(DEFAULT)
    })

    it('falls back to the default layout when storage cannot be read', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('blocked', 'SecurityError')
      })
      expect(reload().columns).toEqual(DEFAULT)
    })

    it('rejects panel ids glued together with commas', () => {
      localStorage.setItem(KEY, JSON.stringify({ left: ['program,results,stable'], right: [] }))
      expect(reload().columns).toEqual(DEFAULT)
    })
  })

  describe('move', () => {
    it('moves a panel up within its column', () => {
      const layout = useLayoutStore()
      layout.move('results', 'up')
      expect(layout.columns.right).toEqual(['results', 'program'])
      expect(layout.announcement).toBe('Results panel moved to the right column, position 1 of 2.')
    })

    it('moves a panel down within its column', () => {
      const layout = useLayoutStore()
      layout.move('program', 'down')
      expect(layout.columns.right).toEqual(['results', 'program'])
      expect(layout.announcement).toBe('Program panel moved to the right column, position 2 of 2.')
    })

    it('moves a panel to the other column at the same position', () => {
      const layout = useLayoutStore()
      layout.move('program', 'left')
      expect(layout.columns).toEqual({ left: ['program', 'stable'], right: ['results'] })
      expect(layout.announcement).toBe('Program panel moved to the left column, position 1 of 2.')
    })

    it('appends to the other column when it is shorter than the position', () => {
      const layout = useLayoutStore()
      layout.move('results', 'left')
      expect(layout.columns).toEqual({ left: ['stable', 'results'], right: ['program'] })
      expect(layout.announcement).toBe('Results panel moved to the left column, position 2 of 2.')
    })

    it('moves the only panel out of a column, leaving it empty', () => {
      const layout = useLayoutStore()
      layout.move('stable', 'right')
      expect(layout.columns).toEqual({ left: [], right: ['stable', 'program', 'results'] })
      expect(layout.announcement).toBe('Stable panel moved to the right column, position 1 of 3.')
    })

    it.each([
      ['program', 'up'],
      ['results', 'down'],
      ['stable', 'up'],
      ['stable', 'down'],
      ['stable', 'left'],
      ['program', 'right'],
    ] as const)('leaves %s in place when moved %s past an edge', (id, direction) => {
      const layout = useLayoutStore()
      layout.move(id, direction)
      expect(layout.columns).toEqual(DEFAULT)
      expect(layout.announcement).toBe('')
    })

    it('keeps the previous announcement when a move does nothing', () => {
      const layout = useLayoutStore()
      layout.move('results', 'up')
      layout.move('results', 'up')
      expect(layout.announcement).toBe('Results panel moved to the right column, position 1 of 2.')
    })

    it('is no longer the default after a move, and is again after moving back', () => {
      const layout = useLayoutStore()
      layout.move('results', 'up')
      expect(layout.isDefault).toBe(false)
      layout.move('results', 'down')
      expect(layout.isDefault).toBe(true)
    })

    it('saves the new layout', async () => {
      const layout = useLayoutStore()
      layout.move('stable', 'right')
      await nextTick()
      expect(saved()).toEqual({ left: [], right: ['stable', 'program', 'results'] })
    })

    it('restores the moved layout on the next visit', async () => {
      useLayoutStore().move('program', 'left')
      await nextTick()
      expect(reload().columns).toEqual({ left: ['program', 'stable'], right: ['results'] })
    })

    it('keeps working when storage cannot be written', async () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('full', 'QuotaExceededError')
      })
      const layout = useLayoutStore()
      layout.move('program', 'left')
      await nextTick()
      expect(layout.columns.left).toEqual(['program', 'stable'])
    })
  })

  describe('reset', () => {
    it('puts every panel back in its default place and says so', () => {
      const layout = useLayoutStore()
      layout.move('stable', 'right')
      layout.move('results', 'left')
      layout.reset()
      expect(layout.columns).toEqual(DEFAULT)
      expect(layout.isDefault).toBe(true)
      expect(layout.announcement).toBe('Panels are back in their default places.')
    })

    it('saves the default layout', async () => {
      const layout = useLayoutStore()
      layout.move('stable', 'right')
      await nextTick()
      layout.reset()
      await nextTick()
      expect(saved()).toEqual(DEFAULT)
    })

    it('never lets later moves change the default it resets to', () => {
      const layout = useLayoutStore()
      layout.reset()
      layout.move('stable', 'right')
      layout.reset()
      expect(layout.columns).toEqual(DEFAULT)
      expect(reload().columns).toEqual(DEFAULT)
    })
  })
})
