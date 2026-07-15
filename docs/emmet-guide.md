# The mini-Emmet syntax — every way to use it

DBE's command palette includes a minimal Emmet-style syntax for building
elements from a single line of text. This page lists everything it supports,
everything it deliberately does not, and where the same machinery shows up
elsewhere in the plugin.

## Where to type it

1. Open the builder and select an element in the Navigator (or on the canvas).
2. Press **Cmd/Ctrl+Shift+K** to open the command palette
   (requires the *Command palette* feature, Editing tab — experimental).
3. Choose **Add elements (Emmet)**, type an expression, press **Enter**.

Where the new elements land follows the same slot rule everywhere in DBE:
**inside** the selected element as its last children when it can hold
children, or **after** it as siblings when it is a void element
(`img`, `hr`, `br`, `input`…).

Everything is created through the builder's own add channel, so it repaints
immediately, persists on Save, and each added element can be removed with
Cmd/Ctrl+Z while *Undo / redo add & delete* is on.

## Syntax reference

| Piece | Meaning | Example |
| --- | --- | --- |
| `tag` | Element with that HTML tag | `section` |
| `.class` | Add a class (repeatable) | `div.card.card--wide` |
| `#id` | Set the element's id | `form#enquiry` |
| `[attr=value]` | Add HTML attributes (repeatable, several per bracket) | `a[href=/contact/ target=_blank]` |
| `{text}` | The element's text content | `h2{Key features}` |
| `>` | Step down: the next element is a child | `ul>li` |
| `+` | Stay level: the next element is a sibling | `h2{Title}+p{Lead}` |
| `*N` | Repeat the element N times (capped at 50) | `li{Item}*4` |

Details worth knowing:

- **Omitted tag.** `.card` becomes a `div.card`; a bare `{Some text}`
  becomes a `span` containing the text.
- **Attribute values** may be bare (`[href=/contact/]`), double quoted
  (`[aria-label="Main menu"]`) or single quoted. A bare name (`[hidden]`,
  `[data-gallery-open]`) stores an empty value, which renders as the bare
  attribute — correct for boolean attributes.
- **Several attributes** fit in one bracket, space separated:
  `a.btn[href=/contact/ target=_blank rel=noopener]{Contact}`.
- **Dynamic data tokens** are plain text to Emmet, so they pass straight
  through in both text and attribute values:
  `li{[[title]]}` or `img[src={{{url}}} alt={{alt}}]`.
- **Labels.** Each element's Navigator label is its capitalised tag
  (`Section`, `Li`) — rename afterwards as usual.

## Worked examples

```text
section.features>h2{Key features}+ul.features-list>li{Feature}*4
```
A section containing a heading and a list of four identical items.

```text
a.btn[href=/contact/ target=_blank aria-label="Contact us"]{Contact}
```
A fully attributed link in one line.

```text
figure.property-photo>img[src=/images/hero.webp alt="" loading=lazy]+figcaption{The garden in June}
```
A figure with an image (empty alt = decorative) and a caption.

```text
div.field>label[for=email]{Email address}+input#email[type=email name=email autocomplete=email]
```
A labelled form field, association included.

## What is intentionally NOT supported

- Grouping `()`, climb-up `^`, item numbering `$`, implicit tag names from
  context, and abbreviation expansion (`!`, `link:css`…). Keep expressions
  as a single `>`/`+` chain; run the palette twice for a second branch.
- Collection / Template modules. Emmet builds plain elements only (for now);
  use *Wrap in… Collection + template*, or *Import HTML* with a
  `data-b-context` attribute, to create dynamic lists.

## Safety: the shared attribute gate

Attribute input is sanitised by the same gate as the *Edit as HTML* and
*Import HTML* dialogs (`dbeAttrBlocked` in builder.js), because Builderius
renders attribute values raw on the front end. Silently dropped:

- event-handler attributes (`onclick`, `onload`, any `on*`),
- `javascript:` URLs in `href`, `src`, `action`, `formaction`, `xlink:href`,
- the plugin's own reserved markers (`data-dbe-id`, `data-dbe-module`).

Everything else (including `data-*`, `aria-*`, `role`, `style`) is stored
exactly as typed.

## The same parser elsewhere

The palette's other two input commands are related but simpler, and take
different syntax:

- **Add classes**: space separated or dot notation (`card card--wide` or
  `.card.card--wide`) — no Emmet.
- **Add attributes**: semicolon-separated pairs (`name=value; name2=value2`)
  — no Emmet, same sanitisation.

*Last updated: July 2026 (attribute support added on the
`explore/html-converter` branch).*
