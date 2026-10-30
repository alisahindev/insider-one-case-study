import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import NumberStepper from '../NumberStepper.vue'

type Props = { modelValue: number; min: number; max: number; step?: number; unit?: string }

/** Mounts the stepper with a working v-model, like a parent would. */
function stepper(props: Props) {
  const wrapper = mount(NumberStepper, {
    props: {
      label: 'horses',
      ...props,
      'onUpdate:modelValue': (value: number) => wrapper.setProps({ modelValue: value }),
    },
  })
  const [decrease, increase] = wrapper.findAll('button')
  return { wrapper, decrease: decrease!, increase: increase!, output: wrapper.get('output') }
}

describe('NumberStepper', () => {
  it('is a labelled group with labelled buttons and a live value', () => {
    const { wrapper, decrease, increase, output } = stepper({ modelValue: 5, min: 1, max: 20 })
    expect(wrapper.attributes()).toMatchObject({ role: 'group', 'aria-label': 'horses' })
    expect(decrease.attributes('aria-label')).toBe('Decrease horses')
    expect(increase.attributes('aria-label')).toBe('Increase horses')
    expect(output.text()).toBe('5')
    expect(output.attributes('aria-live')).toBe('polite')
  })

  it('steps by one by default, in both directions', async () => {
    const { wrapper, decrease, increase, output } = stepper({ modelValue: 5, min: 1, max: 20 })
    await increase.trigger('click')
    await increase.trigger('click')
    await decrease.trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([[6], [7], [6]])
    expect(output.text()).toBe('6')
  })

  it('shows a unit and steps by a custom amount', async () => {
    const { increase, output } = stepper({
      modelValue: 1200,
      min: 400,
      max: 3200,
      step: 200,
      unit: 'm',
    })
    expect(output.text()).toBe('1200m')
    await increase.trigger('click')
    expect(output.text()).toBe('1400m')
  })

  it('disables decrease at the minimum and increase at the maximum', async () => {
    const { decrease, increase } = stepper({ modelValue: 1, min: 1, max: 2 })
    expect(decrease.attributes('disabled')).toBeDefined()
    expect(increase.attributes('disabled')).toBeUndefined()
    await increase.trigger('click')
    expect(increase.attributes('disabled')).toBeDefined()
    expect(decrease.attributes('disabled')).toBeUndefined()
  })

  it('disables both buttons when min equals max', () => {
    const { decrease, increase } = stepper({ modelValue: 1, min: 1, max: 1 })
    expect(decrease.attributes('disabled')).toBeDefined()
    expect(increase.attributes('disabled')).toBeDefined()
  })

  it('clamps a step that would overshoot the bounds', async () => {
    const up = stepper({ modelValue: 3100, min: 400, max: 3200, step: 200 })
    await up.increase.trigger('click')
    expect(up.wrapper.emitted('update:modelValue')).toEqual([[3200]])

    const down = stepper({ modelValue: 500, min: 400, max: 3200, step: 200 })
    await down.decrease.trigger('click')
    expect(down.wrapper.emitted('update:modelValue')).toEqual([[400]])
  })

  it('reacts when the bound changes under it (e.g. per-round max follows the stable)', async () => {
    const { wrapper, increase } = stepper({ modelValue: 5, min: 1, max: 10 })
    await wrapper.setProps({ max: 5 })
    expect(increase.attributes('disabled')).toBeDefined()
  })

  it('works with v-model in a parent', async () => {
    const count = ref(2)
    const wrapper = mount(
      defineComponent(
        () => () =>
          h(NumberStepper, {
            modelValue: count.value,
            'onUpdate:modelValue': (v: number) => (count.value = v),
            label: 'rounds',
            min: 1,
            max: 10,
          }),
      ),
    )
    await wrapper.get('[aria-label="Increase rounds"]').trigger('click')
    expect(count.value).toBe(3)
    expect(wrapper.get('output').text()).toBe('3')
  })
})
