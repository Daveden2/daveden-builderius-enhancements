# Daveden Builder Enhancements

The **Daveden Builder Enhancements** plugin is a community-driven quality-of-life, theming and accessibility enhancements companion plugin for the
[Builderius](https://builderius.io/) builder UI. Each feature is added behind its own toggle and can be found in
(admin menu: **Builderius → Builder Enhance**. By [Daveden](https://youtube.com/@daveden2).

<img width="866" height="650" alt="The Builder Enhance menu item as a submenu of the Builderius option in the WP Dashboard" src="https://github.com/user-attachments/assets/b0793f33-96cd-4c10-93e6-56064dd8ab70" />

Every tweak touches only the builder chrome to speed up the developer's workflow while building. It doesn't affect the front
end of the site. Also, each feature is intended to be retired as a native equivalent lands in core Builderius.

## Highlights: ##

- **Light/dark/auto theme** for the builder chrome, with a top-bar switcher (props to David McCan)
- **Navigator panel upgrades:** improved tag badges, element filter search, collapse/expand elements tree, inline rename, simple undo/redo of added/deleted elements, "Wrap in…", rearrangeable favourites bar
- **Styles panel** — CSS code editor by default, scope badge with an instant Global/Template switch, bulk class naming
- **Workflow** — preview resize handles in preparation for container-query work, tooltips and accessible names for icon-only buttons, density toggle
- **Contextual Menu:** We now get an improved contextual menu for the navigator elements tree as well as for the element styles class pill.

## Requirements

- WordPress 6.4+, PHP 7.4+
- Targets **Builderius and Builderius Pro**. All JS features fail softly: selector drift degrades to "feature missing", never a broken builder.

## Installation

Download the latest release asset and install it like any other WordPress plugin. You'll receive automatic updates after that.

> **Critical:** the plugin directory name MUST contain `builderius`. In builder mode, Builderius removes every hook whose callback file lives under `wp-content/plugins` unless the path contains an allowlisted plugin name. If you rename the plugin folder, every builder feature silently vanishes.

## Release Process

The plugin checks this repository's GitHub **releases** via [plugin-update-checker](https://github.com/YahnisElsts/plugin-update-checker)
and offers updates on the WordPress Plugins screen.

Release flow: bump the version in `daveden-builderius-enhancements.php` (header + `DBE_VERSION`) and `readme.txt` (stable tag + changelog), commit,
tag `vX.Y.Z`, then publish a GitHub release for that tag.

## Contributing

Suggestions, bug reports and pull requests are welcome — see
[CONTRIBUTING.md](CONTRIBUTING.md). Contributors are listed in
[CONTRIBUTORS.md](CONTRIBUTORS.md).

## Licence

GPL-2.0-or-later.
