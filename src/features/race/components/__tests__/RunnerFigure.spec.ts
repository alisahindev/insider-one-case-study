import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { Horse } from '../../domain/types'
import RunnerFigure from '../RunnerFigure.vue'

const horse = (hex: string): Horse => ({
  id: 1,
  name: 'Ada',
  color: { name: 'X', hex },
  condition: 50,
})

describe('RunnerFigure', () => {
  it.each(['stand', 'gallop', 'hold'] as const)('shows the %s pose', (pose) => {
    const figure = mount(RunnerFigure, { props: { horse: horse('#1F6FEB'), pose } })
    expect(figure.classes()).toEqual(['figure', `figure--${pose}`])
    expect(figure.attributes('aria-hidden')).toBe('true')
    expect(figure.find('.sprite').exists()).toBe(true)
  })

  it('paints the coat and a readable outline', async () => {
    const figure = mount(RunnerFigure, { props: { horse: horse('#1B1B3A'), pose: 'stand' } })
    const style = (figure.element as HTMLElement).style
    expect(style.getPropertyValue('--coat')).toBe('#1B1B3A')
    expect(style.getPropertyValue('--outline')).toBe('#F7F7F2')

    await figure.setProps({ horse: horse('#F5D90A'), pose: 'gallop' })
    expect(style.getPropertyValue('--outline')).toBe('#14211A')
    expect(figure.classes()).toContain('figure--gallop')
  })
})
