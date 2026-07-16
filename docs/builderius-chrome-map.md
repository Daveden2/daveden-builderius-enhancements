# Builderius chrome / editor region map

A reference for the regions of the Builderius builder UI ("chrome") and the
class names this plugin keys off. Builderius does **not** publish an official
public glossary; these are its internal markup conventions. Every structural
class is namespaced `uni` (Builderius' "universal" design-system prefix), so the
names below are stable but unofficial. Verified against the live DOM (July 2026).

The plugin's own hooks/classes use the `dbe-` / `--dbe-` prefix and are injected
into these regions; see `AGENTS.md` and the feature registry in
`includes/features.php`.

## Top bar (top toolbar) — `.uniTopPanel`

Full-width bar across the top (~43px).

| Part | Class | What it is |
| --- | --- | --- |
| Left cluster | `.uniTopPanel__leftCol` | |
| ↳ Builderius menu | `.uniPanelButton--builderiusMenu` | The "Elements" entity/menu dropdown (top-left) |
| Centre cluster — responsive / canvas controls | `.uniGlobalBreakpoints` | |
| ↳ Canvas size | `.uniGlobalBreakpoints__canvasControl` | Width (px) + zoom (%) inputs |
| ↳ Breakpoint settings | `.uniGlobalBreakpoints__modalIcon` | Opens the breakpoints modal |
| ↳ Breakpoint switcher | `.uniGlobalBreakpoints__list` (`role="radiogroup"`) | All / Desktop / Tablet / Mobile buttons (`.uniPanelButtonBreakpoint`) |
| ↳ Reload canvas | `.uniReloadIframeBtn` | |
| Right cluster | `.uniTopPanel__rightCol` | Theme/density buttons (DBE), entity selector (`.uniSystemSelect`), hide-side-panels toggle, preview-in-new-tab (eye), **Save** (`.uniPanelButtonPrimary`) |

## Work area — `.uniMainPanel`

Everything below the top bar. Holds the left panel, canvas and right panel.

### Left panel (contextual) — `.uniLeftPanel` / `.uniLeftPanelOuter`

Switches purpose by context:

- **Inserter** (element library): `.uniModList` → `.uniModItems` →
  `.uniModItems__catWrapper` (a category) → `.uniCatTitle` (header) +
  `.uniModItems__items` (the grid of `.uniModItems__item` element buttons).
- **Settings** for the selected element: the Content / Styles / Attributes tabs
  (`.uniPanelTabs`), with `.uniPanelHeader`. The class picker lives in the Styles
  view (`.uniSystemSelectClasses`).
  - Setting groups (Primary / Advanced / Attributes) are
    `.uniModCssCatWrapper`: header `.uniCatTitle.uniModCssCatWrapper__catTitle`
    (a plain div, mouse-only natively — the settings_accordions feature
    retrofits the disclosure-button semantics) + `.uniModCssCatWrapper__items`,
    which is **lazy-rendered**: a collapsed group has no items node at all,
    and the collapsed state persists globally per group name.
  - Field anatomy: `.uniFormField` rows; block labels
    `.uniFormField__settingLabel`, switch/inline labels
    `.uniFormField__settingLabelInline` (both gain `.nonEmptyValue` in the
    native accent when set); the description tile for a field's `infoMsg` is
    `.uniFormField__boxInfo` (natively `--primary-2` fill + `--primary-4`
    text — repainted for light theme in 60-theme.css pass 19).
  - The media library (Select image flow) opens over the canvas as
    `.uniMediaLibrary`: tiles `.uniMediaLibrary__item` (click → `active` +
    a `.uniMediaLibrary__sidebar` with size picker and an **Insert** button
    that actually applies src/alt — selection alone changes nothing).

### Canvas (preview) — `.uniIframePanel`

The preview iframe where the page renders (`.uniIframePanel__outerWrapper` /
`__outer`; the iframe itself is `#builderInner`). Canvas nodes carry
`.uni-node-<moduleId>` (one per rendered instance — a looped element inside a
Collection has several).

### Right panel — the Navigator — `.uniRightPanel`

| Part | Class | What it is |
| --- | --- | --- |
| Element tree | `.uniModTree` | The structure tree; rows are `.uniModTree__item`, each also carrying `.uni-tree-node-<moduleId>` |
| Favourites bar | `.uniModTree__favouritesList` | Quick-add module shortcuts (`.uniModTree__favouritesListItem`) |
| Tree footer | `.uniModTree__footer` | Delete selected / edit favourites |
| Panel tabs | `.uniPanelTabs` | Elements / Selectors / CSS vars |
| Header icons | `.uniPanelHeader__icons` | Collapse / expand the tree |

## Footer bar (status / utility) — `.uniFooterPanel` / `.uniFooterPanelBar`

Full-width bar across the bottom (~28px), outside `.uniMainPanel`. Holds Custom
CSS, Libraries, Translations, Accessibility, Shortcuts and the **Interactive
canvas** toggle. `.uniFooterPanelContentInner` is the expandable panel that opens
above the bar.

## Overlays

| Region | Class | Notes |
| --- | --- | --- |
| Modal dialog | `.uniModal` | e.g. the breakpoints table (`.uniBreakpointsTable`) |
| Context menu | `.uniBuilderContextMenu` | Right-click menu |
| Sense AI terminal | `.uniAiChat` | AI chat |
| Native tooltip | `.builderiusTooltip.react-tooltip` | react-tooltip; anchors are `.tooltipItem.tooltipId__<id>` carrying `data-tooltip-content` |

## Module store

Current module state is read from `window.__builderiusStoreFns`:
`storeGet('modules')` (map of `id → module`) and `storeGet('activeModule')`
(selected id). A module's `name` is its type — `HtmlElement`, `Collection`,
`SubCollection`, `Template`, `Component`, `RecursiveTemplate`, or a `*Composite`;
its `settings` array holds `tag`, `tagClass` (applied classes), etc.

> Elements inside a Collection's `Template` are defined **once** in the tree but
> rendered **N times** on the canvas (one `.uni-node-<id>` per collection item).
