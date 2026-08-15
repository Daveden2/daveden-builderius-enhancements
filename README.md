# Daveden Builder Enhancements

**A free, open-source companion plugin that makes the [Builderius](https://builderius.io/) builder interface faster, calmer and more accessible.**

Around sixty separate improvements to the builder chrome, each behind its own toggle, so you switch on only what you want. Find them under **Builderius → Builder Enhancements** in the WordPress dashboard. Built by [Daveden](https://youtube.com/@daveden2).

<img width="866" height="650" alt="The Builder Enhancements menu item under Builderius in the WordPress dashboard" src="https://github.com/user-attachments/assets/b0793f33-96cd-4c10-93e6-56064dd8ab70" />

Every change touches the builder chrome only. Nothing is added to the front end of your site, and nothing is written into your templates. Each feature is intended to be retired as a native equivalent lands in Builderius itself.

- [What it does](#what-it-does)
- [Requirements](#requirements)
- [Installation](#installation)
- [Settings](#settings)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [Support](#support)
- [Releases](#releases)
- [Licence](#licence)

## What it does

### Accessibility

The builder is reachable and readable by keyboard and screen reader. Landmark regions for the top bar, panels and canvas; arrow-key toolbars; keyboard access to the Inserter, the panel tabs and the Builderius menu; proper combobox and tab semantics on custom widgets; a visible focus ring on every control; accessible names on icon-only buttons; and contrast fixes for overlays and forced-colours mode.

### Navigator

Filter search that hides branches which do not match, collapse and expand the whole tree, follow-selection that keeps your place visible, tag badges, inline rename, full keyboard operation of the tree, per-row quick actions, a rearrangeable favourites bar, and the option to detach the panel.

### Editing

A regrouped right-click menu with flyouts for inserting, moving and advanced tools. Move elements up, down, in and out; wrap a selection in a new element; paste where you click in the Navigator; rename by double-click; undo a deletion, with Redo after undoing. Helpers for HTML attributes, image defaults, display conditions and component property order.

### HTML authoring tools

- **Edit as HTML** *(Pro, experimental, off by default)* — open an element and everything inside it as plain HTML, edit it, and apply the changes back. A preview shows exactly what will change first.
- **Import HTML** *(Pro, experimental, off by default)* — paste markup from anywhere, preview the elements it will create, and insert them. Repeated blocks can be collapsed into a Collection, and a pasted SVG stays editable.
- **Change tag** *(Pro)* — change an element's HTML tag from the Navigator or the command palette, keeping its label and any data binding.
- A **shorthand syntax** for building elements quickly from the command palette. See the [Emmet guide](docs/emmet-guide.md).

The two editors rewrite a whole element in one step and that step cannot be undone, so they stay off by default and carry a warning on the settings screen. Pasted markup is cleaned before it reaches the builder, and the tools are available only to users who are already allowed to post unfiltered HTML.

### Styles panel

The CSS code editor open by default, a scope badge with an instant Global/Template switch, an All CSS shortcut, bulk BEM-style class naming, an explainer for the `%local%` and `%selector%` hints, and the option to hide the editor minimap. Most of this section needs Builderius Pro.

### Appearance and workflow

A light, dark or follow-the-OS theme for the builder chrome with a top-bar switcher (props to David McCan), a comfortable/compact density toggle, resizable panels, restyled controls and a consistent typeface.

For workflow: `Cmd`/`Ctrl`+`S` to save, a save-state cue for Builderius versions before 1.3.6, a command palette on `Cmd`/`Ctrl`+`K`, a keyboard-shortcuts overlay, a warning when another tab has the same template open with unsaved changes, protection for hand-written CSS blocks, and drag handles for resizing the preview canvas around its centre for container-query work.

## Requirements

- WordPress 6.4 or later, PHP 8.2 or later
- **Builderius** (the free wordpress.org plugin) active. DBE is currently audited against 1.3.6-beta; on WordPress 6.5+ the hard dependency is enforced natively through the `Requires Plugins` header.
- A handful of features need **Builderius Pro**. They are labelled on the settings screen and stay hidden without it.

Every JavaScript feature fails softly. If a future Builderius release moves the markup a feature depends on, that feature reports itself as missing rather than breaking the builder.

## Installation

Download `daveden-builderius-enhancements.zip` from the [latest release](https://github.com/Daveden2/daveden-builderius-enhancements/releases/latest) and install it like any other WordPress plugin. The bundled [update checker](https://github.com/YahnisElsts/plugin-update-checker) watches this repository's releases, so you will be offered updates on the Plugins screen from then on.

> [!IMPORTANT]
> The plugin directory name **must** contain `builderius`. In builder mode, Builderius removes every hook whose callback file lives under `wp-content/plugins` unless the path contains an allowlisted plugin name. If you rename the folder, every builder feature silently disappears.

## Settings

**Builderius → Builder Enhancements.** A tab rail shows how much of each section is switched on. Every feature is a name, a switch and a plain description; one switch turns a whole tab or section on or off.

The Dashboard tab offers quick-start presets: accessibility, keyboard, visual, safer editing and power editing. A preset switches on a considered set of features in one step and never turns anything off. Nothing is saved until you review the changes and press Save.

Switching a feature off releases everything it added: listeners, observers, timers and generated interface state. Uninstalling the plugin removes its options.

## Documentation

- [CHANGELOG.md](CHANGELOG.md) — full, detailed release notes
- [docs/emmet-guide.md](docs/emmet-guide.md) — the element shorthand used by the command palette and Import HTML
- [docs/builderius-chrome-map.md](docs/builderius-chrome-map.md) — a map of the builder interface regions, for contributors

## Contributing

Suggestions, bug reports and pull requests are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md); contributors are credited in [CONTRIBUTORS.md](CONTRIBUTORS.md). Bug reports are most useful with your WordPress, PHP, Builderius and plugin versions, and the browser you saw it in.

## Support

Daveden Builder Enhancements is free and open source. If it saves you time, you can support its continued development through [GitHub Sponsors](https://github.com/sponsors/Daveden2), [Ko-fi](https://ko-fi.com/Daveden2) or [PayPal](https://paypal.me/daveden2). Support is entirely optional; every feature remains available either way.

## Releases

Releases ship from `main`; day-to-day work lands on `develop`. Merging the release pull request tags the version, publishes the GitHub release from the `readme.txt` notes and attaches the distributable zip. The process is written up in [RELEASING.md](RELEASING.md).

## Licence

Licensed under the **GNU General Public License, version 2 or later** — see [LICENSE](LICENSE) for the full text.

The plugin is free software and free of charge. There is no paid tier, no upsell and no telemetry.

## A note on names

This is an independent community project. It is not affiliated with, endorsed by or supported by Builderius. Please report problems here rather than to the Builderius team.
