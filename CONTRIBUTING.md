# Contributing

Thanks for your interest in improving Daveden Builder Enhancements. The plugin
exists to prototype tweaks the Builderius community would like to see in the
builder itself, so ideas and bug reports are just as valuable as code.

## Suggest a tweak or report a bug

Open a [GitHub issue](https://github.com/Daveden2/daveden-builderius-enhancements/issues)
and include:

- What you expected the builder to do, and what happens instead
- Your Builderius version (the plugin currently targets **1.3.5-beta**)
- For UI bugs: a screenshot, and anything relevant from the browser console

Feature suggestions should describe the *workflow problem*, not just the
solution — remember that every tweak here is intended to be retired once a
native equivalent lands in core Builderius.

## Development setup

1. Clone the repository into `wp-content/plugins/daveden-builderius-enhancements`
   on a local WordPress site (6.4+, PHP 8.2+) with Builderius active.
2. Activate **Daveden Builder Enhancements** and open the settings page
   (Builderius → Builder Enhance).
3. Open any template in the builder (`?builderius` on the front end) to see
   the injected features.

> **Critical:** the plugin directory name must contain `builderius` — in
> builder mode Builderius strips every hook from plugins whose path does not
> contain an allowlisted plugin name. Rename the folder and every feature
> silently vanishes.

There is no compile step: PHP, CSS and JavaScript ship as-is. Builder CSS is
assembled into a content-addressed uploads bundle on first use, so editing a
source file changes its signature and a plain builder reload picks up the new
bundle.

## How the code is organised

- `includes/features.php` — the feature registry, the single source of truth.
  Every toggle is declared here once; the settings page, option defaults,
  sanitisation, CSS concatenation and the JS config object are all derived
  from it.
- `includes/output-builder.php` — resolves enabled CSS files from the registry,
  links their cacheable bundle in `wp_head`, and prints the config plus ordered
  JavaScript prerequisites in `wp_footer`. Inline CSS is the filesystem-failure
  fallback.
- `includes/builder-css-cache.php` — signatures, atomically writes and prunes
  the site-specific generated CSS bundles under uploads.
- `includes/abilities.php` — shared Builderius entity, commit, lock and GraphQL
  services, plus the ordered registrar for agent-facing abilities.
- `includes/abilities/` — domain-owned ability schemas and callbacks. Keep
  public IDs, permissions and error contracts stable when moving a domain;
  reuse the shared transaction services instead of duplicating them.
- `assets/builder/js/builder.js` — the small shared host. Physical chunks under
  `assets/builder/js/chunks/` own the accessibility, workspace, editing, styles,
  integrations and commands domains.

## Conventions

- **Prefixes:** `dbe_` for PHP functions, `.dbe-` for injected DOM classes,
  `--dbe-` for CSS custom properties, `data-dbe-*` for data attributes.
- **Per-feature CSS files** named `NN-feature.css` — the numeric prefix
  defines the cascade order. Register the file in the feature's registry
  entry (shared infrastructure files are OR-gated in
  `dbe_builder_css_files()` instead).
- **Fail soft.** Every feature must degrade to "feature missing" — never a
  broken builder. Wrap wiring in `try`/`catch`, presence-check selectors, and
  provide fallbacks for anything read from Builderius internals.
- **No dependencies.** Vanilla JavaScript only; no build tooling, no jQuery,
  no external libraries.
- **Accessibility is a floor.** Injected UI meets WCAG 2.2 AA: visible focus
  indicators, 24×24px pointer targets, full keyboard operability, and screen
  reader announcements where state changes silently.
- **British English** in prose, comments and UI copy (US spellings stay in
  code identifiers where an API requires them).
- Indentation: tabs in PHP (WordPress coding standards), 4 spaces in the
  builder JS/CSS, 2 spaces in `assets/admin/`.

## Coding standards

PHP is checked against the **WordPress coding standards** (WPCS) via
PHP_CodeSniffer. The ruleset lives in [`phpcs.xml.dist`](phpcs.xml.dist), and
[a GitHub Action](.github/workflows/phpcs.yml) runs it on every push to
`develop` and every pull request into `develop` or `main`.

Run it locally before opening a pull request:

```bash
# One-off: install the standards globally (kept out of the plugin's vendor/).
composer global config allow-plugins.dealerdirect/phpcodesniffer-composer-installer true
composer global require \
  squizlabs/php_codesniffer:"^3.11" \
  wp-coding-standards/wpcs:"^3.1" \
  phpcompatibility/phpcompatibility-wp:"^2.1"
export PATH="$(composer global config bin-dir --absolute):$PATH"

# From the plugin root — phpcs auto-discovers phpcs.xml.dist:
phpcs            # report violations
phpcbf           # auto-fix what it can
```

## Pull requests

1. Fork, branch from `develop`, and keep the change focused — one tweak or fix
   per pull request. Pull requests target `develop`; the maintainer merges
   `develop` into `main` for releases.
2. New tweaks get a registry entry in `includes/features.php` (so they appear
   on the settings page with their own toggle and default to on) and must
   work correctly when toggled off.
3. Test in the builder against the targeted Builderius version: the feature
   works, survives React re-renders (panel switches, element selection), and
   the browser console stays clean.
4. Update `readme.txt` (changelog) when the change is user-visible.
5. Add yourself to [CONTRIBUTORS.md](CONTRIBUTORS.md) in the same pull
   request.

Versioning and releases are handled by the maintainer through a
`develop → main` pull request, merged with a merge commit, then a tag and a
GitHub release (the bundled update checker serves updates from releases). See
[RELEASING.md](RELEASING.md) for the full checklist.
