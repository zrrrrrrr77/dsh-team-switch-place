# Team switch on top (dsh-team-switch-place)

Moves the **Agent Teams** switch to the first row of the composer model menu, above Model and Reasoning.

The menu renders the Model and Reasoning rows itself and appends the Teams switch through the `conversation.input.model.options` slot, so the switch always lands third — right where the pointer enters the menu, one stray click away from turning the team on. This bundle lifts that row in the browser and leaves everything else alone: same switch, same state, same request.

- **No tokens**: the host half is empty — no tools, no prompt text, no model requests.
- **No language matching**: the row is found by structure (the only `role="switch"` row in the menu), so it works in every UI language.
- **No official files touched**: no patching, no forking, no overriding shipped packages.
- **Reversible**: disabling or removing the bundle puts the row back third, and the menu re-applies the order on every open.

## Install

```sh
dsh plugin --profile web add dsh-team-switch-place
```

In the desktop app you can also use **Plugins → Add plugin** with the package name, or a local absolute path while developing. Reload the page afterwards (`Ctrl+Shift+R`): the boot manifest is generated per page load, so a newly installed client bundle arrives on refresh. If it does not, restart DSH once and reload.

## Use

Nothing to switch on. Open the model menu under the composer and the Teams switch is the first row. On the keyboard the two paths differ on purpose: `Tab` skips the switch and lands on the reasoning row at the bottom (the Model row when the model publishes no effort levels), while `↑`/`↓` follow the visual order and start at the switch.

## Limitations

- Scoped to the composer model menu on a root session. The `/model` dialog, subagent sessions, and the drilled-in model and reasoning panes are untouched.
- It reads the official menu structure (`role="menuitem"` rows plus a `role="switch"` row inside `role="menu"`). A large upstream redesign may need an update; when the structure is not recognized the plugin does nothing and the menu stays as shipped.
- The `Tab` rule deliberately overrides the official focus order, which would otherwise hand `Tab` to the first row (now the switch). It applies only while the menu is open, focus sits on its trigger, and the key is `Tab`; when the trigger cannot be identified the official behaviour stands.
- It lifts the first row that carries a switch. If another plugin later adds its own switch to this menu, only the one found first is lifted.
- If upstream moves the switch out of the menu, this bundle stops applying.

## Development

```sh
node --check client.js
node simulate.mjs
```

`client.js` is the browser half: a `MutationObserver` watches for the portaled menu and moves the Teams row to the front of its row container. `index.js` is an empty host half. `tools/asar.mjs` is a read-only helper used to read shipped package sources from the installation's `app.asar`; it is not published.

## License

MIT
