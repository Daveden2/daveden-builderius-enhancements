# The mini-Emmet syntax — every way to use it

DBE's command palette includes a minimal Emmet-style syntax for building
elements from a single line of text. This page lists everything it supports,
everything it deliberately does not, and where the same machinery shows up
elsewhere in the plugin.

## Where to type it

1. Open the builder and select an element in the Navigator (or on the canvas).
2. Press **Cmd/Ctrl+K**, or click the palette button in the top bar, to open
   the command palette (requires the *Command palette* feature, Editing tab,
   experimental). The shortcut is changeable in the feature's settings; the
   old Ctrl+Shift+K default is reserved by Firefox on Windows and Linux for
   the DevTools console, so it is no longer the default.
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
| `collection` | Reserved word: a Collection module (div tag, interactive off) | `collection>template>li` |
| `collection:tag` | The same, rendered as that HTML tag | `collection:ul>template>li` |
| `subcollection` | Reserved word: a SubCollection module (`:tag` works too) | `subcollection>template>li` |
| `template` | Reserved word: a Template module | `template>div.card` |

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
- **Reserved words.** `collection`, `subcollection` and `template` build the
  dynamic modules instead of elements. Classes, `#id` and `[attr=value]`
  apply to them as usual (so `collection[data-b-context=…]` binds inline);
  `{text}` has no rendering channel on any of them and is dropped. A
  collection renders as a `div` unless you name its tag with a colon suffix
  — `collection:ul`, `collection:section` — validated against the same
  known-tag list as everything else. A collection may only hold `template`
  children — the palette refuses the expression otherwise, and likewise
  refuses non-template roots when the *selected* element is a Collection.
  There is no real `<collection>` HTML element, so nothing is lost; a real
  `<template>` *element* is what the Template module renders as anyway.

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

## Worked example — a dynamic list in one line

```text
collection:ul.testimonials[data-b-context=testimonials]>template>li.quote{[[content]]}
```

A bound Collection rendered as a `ul`, whose Template holds the repeating
list item. Without the `data-b-context` attribute the collection still
builds; bind it afterwards in its settings. Without `:ul` it renders as a
`div`.

*Last updated: July 2026 (attribute support and the collection/template
reserved words added on the `explore/html-converter` branch).*
