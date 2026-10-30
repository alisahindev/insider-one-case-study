/// <reference types="vitest/jsdom" />
// Minimal stand-ins for browser APIs jsdom lacks, so components run as they do in a browser.

// Node 25+ defines its own localStorage global (unusable without --localstorage-file) that hides jsdom's.
if (typeof localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', { value: jsdom.window.localStorage })
}

// <dialog>: jsdom only reflects the `open` attribute. Opening sets it (and honours autofocus);
// closing clears it and fires `close`, which is what the app listens to.
if (!HTMLDialogElement.prototype.showModal) {
  Object.assign(HTMLDialogElement.prototype, {
    show(this: HTMLDialogElement) {
      this.open = true
    },
    showModal(this: HTMLDialogElement) {
      if (this.open) return
      this.open = true
      this.querySelector<HTMLElement>('[autofocus]')?.focus()
    },
    close(this: HTMLDialogElement) {
      if (!this.open) return
      this.open = false
      this.dispatchEvent(new Event('close'))
    },
  })
}

// No media queries in jsdom: nothing matches unless a test stubs it (e.g. reduced motion).
window.matchMedia ??= (media: string) =>
  ({
    matches: false,
    media,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList

// jsdom's scrollBy only logs "not implemented"; there is no layout to scroll.
window.scrollBy = () => {}
