# Daveden Builder Enhancements

Quality-of-life, theming and accessibility enhancements for the
[Builderius](https://builderius.io/) builder UI — each behind its own toggle
(admin menu: **Builderius → Builder Enhance**; a top-level menu when
Builderius is inactive). By [Daveden](https://youtube.com/@daveden2).

Every tweak touches only the builder chrome — nothing changes on the front
end of the site — and each is intended to be retired as a native equivalent
lands in core Builderius.

Highlights:

- **Light / dark / auto theme** for the builder chrome, with a top-bar switcher
- **Navigator upgrades** — tag badges, search, collapse/expand all, inline
  rename, multi-select, undo delete, "Wrap in…", rearrangeable favourites bar
- **Styles panel** — CSS code editor by default, scope badge with an instant
  Global/Template switch, bulk class naming
- **Workflow** — preview resize handles for container-query work,
  keyboard-shortcuts overlay, unsaved-changes cue, tooltips and accessible
  names for icon-only buttons, density toggle

## Requirements

- WordPress 6.4+, PHP 7.4+
- Targets **Builderius 1.3.5-beta** — selectors, store access
  (`window.__builderiusStoreFns`) and hooks (`Builderius.API.hooks`) were
  audited against that version. Re-audit after any Builderius update. All JS
  features fail soft: selector drift degrades to "feature missing", never a
  broken builder.

## Installation

Copy this repository into `wp-content/plugins/daveden-builderius-enhancements`
and activate **Daveden Builder Enhancements**.

> **Critical:** the plugin directory name MUST contain `builderius`. In builder
> mode Builderius removes every hook whose callback file lives under
> `wp-content/plugins` unless the path contains an allowlisted plugin name —
> rename the folder and every builder feature silently vanishes.

## Updates

The plugin checks this repository's GitHub **releases** via
[plugin-update-checker](https://github.com/YahnisElsts/plugin-update-checker)
and offers updates on the WordPress Plugins screen.

Release flow: bump the version in `daveden-builderius-enhancements.php`
(header + `DBE_VERSION`) and `readme.txt` (stable tag + changelog), commit,
tag `vX.Y.Z`, then publish a GitHub release for that tag.

## Contributing

Suggestions, bug reports and pull requests are welcome — see
[CONTRIBUTING.md](CONTRIBUTING.md). Contributors are listed in
[CONTRIBUTORS.md](CONTRIBUTORS.md).

## Licence

GPL-2.0-or-later.
