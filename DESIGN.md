---
name: Ads Phase Machine
description: >-
  Dark, instrument-panel UI for an autonomous ad-generation loop. Reads as
  telemetry a machine is writing to, not as a dashboard a person fills in.
color:
  background:
    base: "#08090b"
    raised: "#0e1014"
    panel: "#111419"
    inset: "#0a0c0f"
  border:
    default: "#1e232b"
    soft: "#171b22"
  text:
    primary: "#e8ecf1"
    dim: "#9aa4b2"
    faint: "#5f6b7a"
  accent:
    default: "#6868e8"
    dim: "#3b3b8c"
  status:
    good: "#35d39a"
    bad: "#ff5d73"
    warn: "#ffcc55"
    info: "#5aa9ff"
typography:
  fontFamily:
    sans: '"Geist Variable", ui-sans-serif, -apple-system, "Segoe UI", system-ui, sans-serif'
    mono: '"Geist Mono Variable", ui-monospace, SFMono-Regular, Menlo, Monaco, monospace'
  usage:
    prose: sans
    numbers: mono
    labels: mono
  label:
    textTransform: uppercase
    letterSpacing: "0.08em"
    color: "#5f6b7a"
radius:
  default: "10px"
  large: "14px"
elevation:
  panel: 1px solid #1e232b on #111419
  inset: 1px solid #171b22 on #0a0c0f
motion:
  phaseAdvance: width transition on the active phase bar, linear
  cardSwap: image replaces procedural artwork in place, no entrance animation
---

# Look and feel

The screen is an instrument panel. A machine is running whether or not anyone
is watching, and the UI reports on it. Nothing asks to be filled in; almost
everything is a readout. That framing decides most of the small calls below.

## Layout

Three columns under a fixed header and a horizontal phase rail.

- **Left** — controls and inputs. The few places a human acts.
- **Centre** — the ad wall. The output, and the reason the page exists.
- **Right** — what the machine has learned: performance curve, lever index,
  last evolve, log.

The rail spans the full width directly under the header because it is the
spine of the product: seven phases, left to right, the active one lit and
filling. A viewer should be able to point at where the machine *is* without
being told.

## Colour

Near-black backgrounds in four steps, separated by one or two points of
lightness. The steps carry hierarchy on their own, so borders stay hairline and
almost never need to be darker than `#1e232b`.

One accent — violet `#6868e8`, the brand mark's colour — and it is rationed. It
marks the active phase, the primary action, and nothing else. When everything
is grey, one violet element is unmistakable across a room.

Status colours appear only on data: green for a winner, red for a kill or a
cost that got worse, amber for pending, blue for informational. They never
decorate chrome. A red number on this page always means a number got worse.

## Type

Geist for prose, Geist Mono for anything a machine produced — metrics, gene
tags, log lines, ad IDs, timestamps. The split is doing real work: monospace is
how the eye separates "the machine measured this" from "a person wrote this".

Labels are uppercase mono at low contrast, small and quiet. The value below
them carries the weight. Never make a label compete with its own number.

## Density

Dense, and deliberately so — the appeal is seeing the whole system at once.
Panels are tight, metrics sit in a single row, the log is small and scrolling.

Copy earns its place or it goes. Descriptive text under a control that a
competent viewer could infer is noise, and noise is what makes a dense screen
feel cluttered rather than rich. Prefer a shorter label to a label plus an
explanation.

## Ad cards

Ad creative renders as a real Facebook feed ad — white card, brand avatar,
"Sponsored", the actual copy, the image, a link footer with a CTA button. It is
the one place that breaks the dark theme, and the contrast is the point: the
product's output should look like the thing it really is, sitting inside the
instrument that made it.

Every card carries a provider badge on the image (`google:gemini-3-pro-image`,
`procedural`, `generating image…`) so it is always clear whether you are
looking at real generated art or the instant placeholder.

## Motion

Almost none. The phase bar fills, images swap in when they land, numbers tick
up as delivery accrues. Nothing slides, fades, or bounces. Movement on this
screen should mean the machine did something, so decorative movement would be
a lie about state.
