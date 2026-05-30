function stepDecimals(step) {
  const parts = String(step).split('.')
  return parts[1] ? parts[1].length : 0
}

export function stepNumberInput(input, direction) {
  const step = parseFloat(input.dataset.step || input.step) || 1
  const min = input.dataset.min !== undefined && input.dataset.min !== ''
    ? parseFloat(input.dataset.min)
    : input.min !== '' ? parseFloat(input.min) : -Infinity
  const max = input.dataset.max !== undefined && input.dataset.max !== ''
    ? parseFloat(input.dataset.max)
    : input.max !== '' ? parseFloat(input.max) : Infinity
  let value = parseFloat(input.value)
  if (!Number.isFinite(value)) value = 0

  value = Math.min(max, Math.max(min, value + direction * step))
  const decimals = stepDecimals(step)
  input.value = decimals > 0 ? value.toFixed(decimals) : String(Math.round(value))
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function buildStepper(input) {
  const wrap = document.createElement('div')
  wrap.className = 'num-stepper'

  if (input.min !== undefined) input.dataset.min = input.min
  if (input.max !== undefined) input.dataset.max = input.max
  if (input.step !== undefined) input.dataset.step = input.step

  const minus = document.createElement('button')
  minus.type = 'button'
  minus.className = 'num-stepper-btn'
  minus.tabIndex = -1
  minus.setAttribute('aria-label', 'Decrease value')
  minus.textContent = '−'

  const plus = document.createElement('button')
  plus.type = 'button'
  plus.className = 'num-stepper-btn'
  plus.tabIndex = -1
  plus.setAttribute('aria-label', 'Increase value')
  plus.textContent = '+'

  minus.addEventListener('mousedown', (e) => e.preventDefault())
  plus.addEventListener('mousedown', (e) => e.preventDefault())
  minus.addEventListener('click', (e) => {
    e.preventDefault()
    input.focus()
    stepNumberInput(input, -1)
  })
  plus.addEventListener('click', (e) => {
    e.preventDefault()
    input.focus()
    stepNumberInput(input, 1)
  })

  wrap.appendChild(minus)
  wrap.appendChild(input)
  wrap.appendChild(plus)

  input.type = 'text'
  input.inputMode = 'decimal'
  input.autocomplete = 'off'
  input.spellcheck = false

  input.addEventListener('focus', () => {
    requestAnimationFrame(() => input.select())
  })

  return wrap
}

export function enhanceNumberInputs(root = document) {
  ;[...root.querySelectorAll('input[type="number"]')].forEach((input) => {
    if (input.closest('.num-stepper')) return

    const parent = input.parentNode
    const next = input.nextSibling
    const parentLabel = input.closest('label')
    const stepper = buildStepper(input)

    if (parentLabel) {
      const field = document.createElement('div')
      field.className = 'field'
      parentLabel.classList.forEach((cls) => field.classList.add(cls))
      if (parentLabel.id) field.id = parentLabel.id

      const caption = document.createElement('label')
      if (input.id) caption.htmlFor = input.id

      while (parentLabel.firstChild) {
        caption.appendChild(parentLabel.firstChild)
      }

      parentLabel.replaceWith(field)
      if (caption.childNodes.length) field.appendChild(caption)
      field.appendChild(stepper)
    } else if (parent) {
      parent.insertBefore(stepper, next)
    }
  })
}
