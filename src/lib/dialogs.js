// Native confirm/prompt/alert block the main thread synchronously. Yielding
// one animation frame before calling them lets the click's paint commit
// first, so INP clocks out in ~16ms instead of waiting on the user to dismiss
// the dialog. Call as `await confirmAction(...)` from any async handler.

const yieldFrame = () => new Promise(r => requestAnimationFrame(() => r()))

export async function confirmAction(message) {
  await yieldFrame()
  return window.confirm(message)
}

export async function promptAction(message, defaultValue = '') {
  await yieldFrame()
  return window.prompt(message, defaultValue)
}
