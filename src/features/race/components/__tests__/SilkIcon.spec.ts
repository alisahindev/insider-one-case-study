import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import type { Horse } from '../../domain/types'
import SilkIcon from '../SilkIcon.vue'

const horse = (id: number, hex = '#1F6FEB'): Horse => ({
  id,
  name: `Horse ${id}`,
  color: { name: 'Blue', hex },
  condition: 50,
})

describe('SilkIcon', () => {
  it('is a decorative 24px shirt in the horse colour by default', () => {
    const svg = mount(SilkIcon, { props: { horse: horse(1) } })
    expect(svg.attributes()).toMatchObject({ width: '24', height: '24', 'aria-hidden': 'true' })
    expect(svg.get('g > rect').attributes('fill')).toBe('#1F6FEB')
  })

  it('takes a size', () => {
    const svg = mount(SilkIcon, { props: { horse: horse(1), size: 18 } })
    expect(svg.attributes('width')).toBe('18')
    expect(svg.attributes('height')).toBe('18')
  })

  it.each([
    [1, 'plain', 1, 0],
    [2, 'hoops', 3, 0],
    [3, 'stripes', 3, 0],
    [4, 'chevron', 1, 1],
    [5, 'quarters', 3, 0],
    [6, 'sash', 1, 1],
    [7, 'plain again', 1, 0],
  ])('horse %i wears %s', (id, _, rects, paths) => {
    const g = mount(SilkIcon, { props: { horse: horse(id) } }).get('g')
    expect(g.findAll('rect')).toHaveLength(rects)
    expect(g.findAll('path')).toHaveLength(paths)
  })

  it('trims the pattern in a colour that reads on the silk', () => {
    const light = mount(SilkIcon, { props: { horse: horse(2, '#F5D90A') } })
    const dark = mount(SilkIcon, { props: { horse: horse(2, '#1B1B3A') } })
    expect(light.get('g').attributes('fill')).toBe('#14211A')
    expect(dark.get('g').attributes('fill')).toBe('#F7F7F2')
  })

  it('gives every instance its own clip path', () => {
    const wrapper = mount(
      defineComponent(() => () => [
        h(SilkIcon, { horse: horse(1) }),
        h(SilkIcon, { horse: horse(1) }),
      ]),
    )
    const ids = wrapper.findAll('clipPath').map((c) => c.attributes('id'))
    expect(new Set(ids).size).toBe(2)
    wrapper
      .findAll('g')
      .forEach((g, i) => expect(g.attributes('clip-path')).toBe(`url(#${ids[i]})`))
  })
})
