/**
 * Headless check for client.js: a minimal DOM good enough for the reorder.
 * Run with `node tools/simulate.mjs`.
 */
import { readFileSync } from 'node:fs'

class El {
  constructor(tag, attrs = {}) {
    this.nodeType = 1
    this.tagName = tag.toUpperCase()
    this.attrs = { ...attrs }
    this.children = []
    this.parentElement = null
  }

  get id() { return this.attrs.id ?? '' }

  get isConnected() {
    let node = this
    while (node.parentElement !== null) node = node.parentElement
    return node.tagName === 'BODY'
  }

  focus() { document.activeElement = this }

  get firstElementChild() { return this.children[0] ?? null }

  get nextElementSibling() {
    const parent = this.parentElement
    if (parent === null) return null
    return parent.children[parent.children.indexOf(this) + 1] ?? null
  }

  appendChild(node) {
    node.remove()
    node.parentElement = this
    this.children.push(node)
    return node
  }

  insertBefore(node, ref) {
    if (ref === null || ref === undefined) return this.appendChild(node)
    const index = this.children.indexOf(ref)
    if (index < 0) throw new Error('insertBefore: reference node is not a child')
    node.remove()
    this.children.splice(index, 0, node)
    node.parentElement = this
    return node
  }

  remove() {
    const parent = this.parentElement
    if (parent === null) return
    const index = parent.children.indexOf(this)
    if (index >= 0) parent.children.splice(index, 1)
    this.parentElement = null
  }

  contains(node) {
    for (let current = node; current !== null; current = current.parentElement) {
      if (current === this) return true
    }
    return false
  }

  getAttribute(name) { return Object.hasOwn(this.attrs, name) ? this.attrs[name] : null }
  setAttribute(name, value) { this.attrs[name] = value }
  removeAttribute(name) { delete this.attrs[name] }
  matches(selector) { return matches(this, selector) }
  querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null }
  querySelectorAll(selector) {
    const found = []
    const visit = (node) => {
      for (const child of node.children) {
        if (matches(child, selector)) found.push(child)
        visit(child)
      }
    }
    visit(this)
    return found
  }
}

function matches(el, selector) {
  const bare = /^\[([a-z-]+)\]$/i.exec(selector.trim())
  if (bare !== null) return Object.hasOwn(el.attrs, bare[1])
  const pattern = /^([a-z]*)\[([a-z-]+)="([^"]*)"\]$/i.exec(selector.trim())
  if (pattern !== null) {
    const [, tag, name, value] = pattern
    if (tag !== '' && el.tagName !== tag.toUpperCase()) return false
    return el.attrs[name] === value
  }
  return el.tagName === selector.trim().toUpperCase()
}

const body = new El('body')
const listeners = new Map()
const byId = (id) => {
  let found = null
  const visit = (node) => {
    for (const child of node.children) {
      if (child.attrs.id === id) found = child
      visit(child)
    }
  }
  visit(body)
  return found
}
const document = {
  body,
  activeElement: null,
  querySelectorAll: selector => body.querySelectorAll(selector),
  getElementById: byId,
  addEventListener: (type, handler) => {
    const set = listeners.get(type) ?? new Set()
    set.add(handler)
    listeners.set(type, set)
  },
  removeEventListener: (type, handler) => { listeners.get(type)?.delete(handler) },
  dispatch: (type, event) => { for (const handler of listeners.get(type) ?? []) handler(event) },
}

const observers = []
class MutationObserver {
  constructor(callback) { this.callback = callback; observers.push(this) }
  observe() {}
  disconnect() { this.active = false }
}

const frames = []
const requestAnimationFrame = (fn) => { frames.push(fn); return frames.length }
const cancelAnimationFrame = (id) => { frames[id - 1] = null }
const flush = () => { while (frames.length > 0) { const fn = frames.shift(); fn?.() } }

let factory = null
let createPlugin = null
const window = {
  __ModuleLoader__: {
    load: ({ factory: create }) => {
      createPlugin = create
      factory = create({})
    },
  },
}

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
new Function('window', 'document', 'MutationObserver', 'requestAnimationFrame', 'cancelAnimationFrame', source)(
  window, document, MutationObserver, requestAnimationFrame, cancelAnimationFrame,
)

const checks = []
const check = (name, ok) => { checks.push({ name, ok }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`) }

const menuitem = label => new El('button', { role: 'menuitem', 'data-label': label })
const teamRow = () => {
  const row = new El('div')
  row.appendChild(new El('span'))
  row.appendChild(new El('button', { role: 'switch' }))
  return row
}

/** Mount a composer model menu with the two built-in rows plus the slot row. */
let menuSeq = 0
const mountMenu = () => {
  const surface = new El('div', { role: 'menu' })
  surface.attrs.id = `model-menu-${++menuSeq}`
  surface.appendChild(menuitem('model'))
  surface.appendChild(menuitem('effort'))
  surface.appendChild(teamRow())
  body.appendChild(surface)
  return surface
}

/** The composer trigger that opened this menu. */
const mountTrigger = (surface) => {
  const trigger = new El('button', { 'aria-haspopup': 'menu', 'aria-controls': surface.attrs.id })
  body.appendChild(trigger)
  return trigger
}

const keyEvent = (key, shiftKey = false) => ({
  key,
  shiftKey,
  defaultPrevented: false,
  preventDefault() { this.defaultPrevented = true },
  stopPropagation() {},
})

const order = surface => surface.children.map(child => child.attrs['data-label'] ?? (child.querySelector('[role="switch"]') !== null ? 'team' : '?'))

const disposers = []
factory.apply({ effect: (fn) => { disposers.push(fn()) } })

const first = mountMenu()
const raised = observers.filter(o => o.active !== false)
raised[raised.length - 1].callback([{ addedNodes: [first] }])
flush()
check('opening the menu lifts the switch above both rows', order(first).join(',') === 'team,model,effort')

const team = first.children[0]
first.appendChild(team)
raised[raised.length - 1].callback([{ addedNodes: [team] }])
flush()
check('lifts the row again after React moves it back', order(first).join(',') === 'team,model,effort')

const trigger = mountTrigger(first)
document.activeElement = trigger
const forwardTab = keyEvent('Tab')
document.dispatch('keydown', forwardTab)
const menuitemRows = first.querySelectorAll('button[role="menuitem"]')
check('Tab from the trigger lands on the reasoning row, not the switch',
  document.activeElement === menuitemRows[menuitemRows.length - 1] && forwardTab.defaultPrevented)

document.activeElement = trigger
const backTab = keyEvent('Tab', true)
document.dispatch('keydown', backTab)
check('Shift+Tab from the trigger is left to the official close',
  !backTab.defaultPrevented && document.activeElement === trigger)

document.activeElement = first.querySelector('button[role="switch"]')
const innerTab = keyEvent('Tab')
document.dispatch('keydown', innerTab)
check('Tab from inside the menu keeps the official behaviour', !innerTab.defaultPrevented)

const reopened = mountMenu()
raised[raised.length - 1].callback([{ addedNodes: [reopened] }])
flush()
check('new menu mount is lifted too', order(reopened).join(',') === 'team,model,effort')

const wrapped = new El('div', { role: 'menu' })
const content = new El('div')
wrapped.appendChild(content)
content.appendChild(menuitem('model'))
content.appendChild(menuitem('effort'))
content.appendChild(teamRow())
body.appendChild(wrapped)
raised[raised.length - 1].callback([{ addedNodes: [wrapped] }])
flush()
check('rows inside a content wrapper are lifted in place', order(content).join(',') === 'team,model,effort')

// The menu can open before the team projection arrives, so the row mounts late.
const late = new El('div', { role: 'menu' })
late.appendChild(menuitem('model'))
late.appendChild(menuitem('effort'))
body.appendChild(late)
raised[raised.length - 1].callback([{ addedNodes: [late] }])
flush()
check('a menu still waiting for the switch is left alone', order(late).join(',') === 'model,effort')

const lateRow = teamRow()
late.appendChild(lateRow)
raised[raised.length - 1].callback([{ addedNodes: [lateRow] }])
flush()
check('the row is lifted when it mounts late', order(late).join(',') === 'team,model,effort')

// A menu that closes while lifted must not break the next open or dispose.
const transient = mountMenu()
raised[raised.length - 1].callback([{ addedNodes: [transient] }])
flush()
check('menu opened after a previous one closed is lifted', order(transient).join(',') === 'team,model,effort')
transient.remove()
raised[raised.length - 1].callback([{ addedNodes: [] }])
flush()

// Mixed layout: built-in rows inside a wrapper, the switch a direct child.
const mixed = new El('div', { role: 'menu' })
const mixedContent = new El('div')
mixed.appendChild(mixedContent)
mixedContent.appendChild(menuitem('model'))
mixedContent.appendChild(menuitem('effort'))
const mixedRow = teamRow()
mixed.appendChild(mixedRow)
body.appendChild(mixed)
raised[raised.length - 1].callback([{ addedNodes: [mixed] }])
flush()
check('a switch outside the row wrapper still reaches the top', mixed.children[0] === mixedRow
  && order(mixedContent).join(',') === 'model,effort')

const plain = new El('div', { role: 'menu' })
plain.attrs.id = 'plain-menu'
plain.appendChild(menuitem('alpha'))
plain.appendChild(menuitem('beta'))
body.appendChild(plain)
raised[raised.length - 1].callback([{ addedNodes: [plain] }])
flush()
check('menus without a switch are untouched', order(plain).join(',') === 'alpha,beta')

const plainTrigger = mountTrigger(plain)
document.activeElement = plainTrigger
const foreignTab = keyEvent('Tab')
document.dispatch('keydown', foreignTab)
check('Tab in a menu this bundle never touched is left alone',
  !foreignTab.defaultPrevented && document.activeElement === plainTrigger)

// A second instance (HMR, or the module evaluated twice) must not disturb the first.
const listenersBefore = listeners.get('keydown')?.size ?? 0
const twinDisposers = []
factory.apply({ effect: (fn) => { twinDisposers.push(fn()) } })
check('a second instance loads without touching the first',
  (listeners.get('keydown')?.size ?? 0) === listenersBefore + 1
  && order(first).join(',') === 'team,model,effort')
twinDisposers.forEach(dispose => dispose())
check('the second instance removes only its own listener',
  (listeners.get('keydown')?.size ?? 0) === listenersBefore
  && order(first).join(',') === 'team,model,effort')

disposers.forEach(dispose => dispose())
const afterDispose = keyEvent('Tab')
document.activeElement = trigger
document.dispatch('keydown', afterDispose)
check('dispose removes the Tab rule', !afterDispose.defaultPrevented)
const restored = order(first).join(',') === 'model,effort,team'
  && order(reopened).join(',') === 'model,effort,team'
  && order(content).join(',') === 'model,effort,team'
  && order(mixedContent).join(',') === 'model,effort'
  && mixed.children[0] === mixedContent
  && mixed.children[1] === mixedRow
check('dispose restores the original order', restored)

const failed = checks.filter(entry => !entry.ok)
console.log(`\n${checks.length - failed.length}/${checks.length} passed`)
process.exit(failed.length === 0 ? 0 : 1)
