import { enableAutoUnmount, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useLayoutStore, type PanelId } from '../../stores/layout'
import PanelHeader from '../PanelHeader.vue'

enableAutoUnmount(afterEach)
beforeEach(() => localStorage.clear())

function mountHeader(panelId: PanelId = 'stable') {
  const pinia = createPinia()
  setActivePinia(pinia)
  const wrapper = mount(PanelHeader, {
    props: { panelId },
    slots: { default: '20 horses' },
    global: { plugins: [pinia] },
    attachTo: document.body,
  })
  return { wrapper, layout: useLayoutStore(), handle: wrapper.get('.handle') }
}

const press = (el: Element, key: string) => {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  el.dispatchEvent(event)
  return event
}
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

describe('PanelHeader', () => {
  it('shows the panel title, its meta slot and a labelled drag handle', () => {
    const { wrapper, handle } = mountHeader('program')
    expect(wrapper.get('h2').attributes('id')).toBe('program-title')
    expect(wrapper.get('h2').text()).toBe('Program')
    expect(wrapper.get('.panel__meta').text()).toBe('20 horses')
    expect(handle.element.tagName).toBe('BUTTON')
    expect(handle.attributes()).toMatchObject({
      type: 'button',
      'aria-label': 'Move Program panel',
      'aria-describedby': 'layout-help',
      'data-handle': 'program',
    })
  })

  it('moves the panel to the other column with Left and Right', () => {
    const { layout, handle } = mountHeader('stable')
    expect(press(handle.element, 'ArrowRight').defaultPrevented).toBe(true)
    expect(layout.columns).toEqual({ left: [], right: ['stable', 'program', 'results'] })
    expect(layout.announcement).toBe('Stable panel moved to the right column, position 1 of 3.')

    press(handle.element, 'ArrowLeft')
    expect(layout.columns).toEqual({ left: ['stable'], right: ['program', 'results'] })
  })

  it('reorders within a column with Up and Down', () => {
    const { layout, handle } = mountHeader('program')
    press(handle.element, 'ArrowDown')
    expect(layout.columns.right).toEqual(['results', 'program'])
    press(handle.element, 'ArrowUp')
    expect(layout.columns.right).toEqual(['program', 'results'])
  })

  it('stays put at the edges but still keeps arrows from scrolling the page', () => {
    const { layout, handle } = mountHeader('program')
    expect(press(handle.element, 'ArrowUp').defaultPrevented).toBe(true)
    expect(press(handle.element, 'ArrowRight').defaultPrevented).toBe(true)
    expect(layout.isDefault).toBe(true)
  })

  it('ignores other keys', () => {
    const { layout, handle } = mountHeader('stable')
    for (const key of ['Enter', ' ', 'Tab', 'a']) {
      expect(press(handle.element, key).defaultPrevented).toBe(false)
    }
    expect(layout.isDefault).toBe(true)
    expect(layout.announcement).toBe('')
  })

  it('puts focus back on its handle after the move', async () => {
    const { handle } = mountHeader('stable')
    ;(handle.element as HTMLElement).blur() // the moved panel re-mounts, so its new handle starts unfocused
    press(handle.element, 'ArrowRight')
    expect(document.activeElement).not.toBe(handle.element)
    await nextFrame()
    expect(document.activeElement).toBe(handle.element)
  })
})
