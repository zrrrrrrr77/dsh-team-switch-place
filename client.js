/**
 * Team switch on top.
 *
 * The composer model menu renders two rows itself 鈥?Model and Reasoning 鈥?and
 * appends `conversation.input.model.options` below them. The Agent Teams switch
 * arrives through that slot, so it always lands third. This bundle lifts that
 * row above the two built-in rows, in the browser only: no host tools, no
 * prompt text, no session state, and no model request.
 *
 * The row is found structurally (the switch inside an open role="menu" surface)
 * rather than by localized copy, so it works in every language, and it is
 * re-applied whenever the portaled menu is mounted again.
 */
window.__ModuleLoader__.load({
  id: 'dsh-team-switch-place',
  factory() {
    const MENU = '[role="menu"]'
    const ROW = 'button[role="menuitem"]'
    const SWITCH = 'button[role="switch"]'
    const MARK = 'data-team-switch-place'

    return {
      inject: [],
      apply(ctx) {
        /** Rows this session moved, with the position they came from. */
        const moved = new Map()
        let frame = null
        let observer = null

        /** The row that carries the switch, resolved against one container. */
        const rowIn = (container) => {
          const toggle = container.querySelector(SWITCH)
          if (toggle === null) return null
          let row = toggle
          while (row !== null && row.parentElement !== container) row = row.parentElement
          return row
        }

        const lift = (surface) => {
          // Only the composer model menu pairs a menuitem row with a switch;
          // other menus (commands, provider lists) are left untouched.
          const firstRow = surface.querySelector(ROW)
          if (firstRow === null) return
          // Rows may be direct children of the surface or live in a content
          // wrapper; the model row and the switch normally share one parent.
          const container = firstRow.parentElement
          if (container === null) return
          let host = container
          let row = rowIn(host)
          if (row === null && host !== surface) {
            // Mixed layout: the built-in rows sit in a wrapper while the slot
            // contribution is a direct child of the surface.
            host = surface
            row = rowIn(host)
          }
          if (row === null) return
          // The move stays inside `host`, so React keeps the real DOM parent on
          // its fiber and its own removeChild still resolves.
          if (row !== host.firstElementChild) {
            if (!moved.has(row)) {
              moved.set(row, { parent: host, next: row.nextElementSibling })
            }
            host.insertBefore(row, host.firstElementChild)
          }
          if (row.getAttribute(MARK) === null) row.setAttribute(MARK, '')
        }

        const scan = () => {
          for (const surface of document.querySelectorAll(MENU)) lift(surface)
          // Menus close and remount constantly; forget rows that left the page
          // so this map cannot grow with every open/close cycle.
          for (const [row, origin] of moved) {
            if (!row.isConnected || row.parentElement !== origin.parent) moved.delete(row)
          }
        }

        const schedule = () => {
          if (frame !== null) return
          frame = requestAnimationFrame(() => {
            frame = null
            scan()
          })
        }

        const relevant = (node) => node.nodeType === 1 && (
          node.matches(MENU) || node.matches(SWITCH)
          || node.querySelector(MENU) !== null || node.querySelector(SWITCH) !== null
        )

        const restore = () => {
          for (const [row, origin] of moved) {
            row.removeAttribute(MARK)
            const { parent, next } = origin
            if (parent === null || !parent.isConnected) continue
            if (row.parentElement !== parent) continue
            const before = next !== null && next.parentElement === parent ? next : null
            parent.insertBefore(row, before)
          }
          moved.clear()
        }

        /**
         * The official card hands Tab from the trigger to its first row, which is
         * now the switch. Land on the reasoning row instead 鈥?the last one, where
         * effort lives 鈥?so Tab from the trigger keeps meaning "change how hard
         * the model thinks". Shift+Tab still closes, and once focus is inside the
         * menu every key stays the official one.
         */
        const onDocumentKeyDown = (event) => {
          if (event.key !== 'Tab' || event.shiftKey || event.defaultPrevented) return
          // Match the official guard: an IME composition owns the keys.
          if (event.isComposing === true) return
          const active = document.activeElement
          if (active === null || typeof active.getAttribute !== 'function') return
          const controls = active.getAttribute('aria-controls')
          if (controls === null) return
          const surface = document.getElementById(controls)
          // Only menus this bundle reordered; other popups keep their own keys.
          if (surface === null || surface.querySelector(`[${MARK}]`) === null) return
          // The reasoning row sits last; without it (a model that publishes no
          // effort levels) the model row is the only one left.
          const rows = surface.querySelectorAll(ROW)
          const row = rows[rows.length - 1]
          if (row === undefined) return
          event.preventDefault()
          event.stopPropagation()
          row.focus()
        }

        ctx.effect(() => {
          scan()
          observer = new MutationObserver((records) => {
            for (const record of records) {
              for (const node of record.addedNodes) {
                if (relevant(node)) {
                  schedule()
                  return
                }
              }
            }
          })
          observer.observe(document.body, { childList: true, subtree: true })
          document.addEventListener('keydown', onDocumentKeyDown, true)
          return () => {
            document.removeEventListener('keydown', onDocumentKeyDown, true)
            observer?.disconnect()
            observer = null
            if (frame !== null) cancelAnimationFrame(frame)
            frame = null
            restore()
          }
        }, 'client-team-switch-place: reorder model menu rows')
      },
    }
  },
})

