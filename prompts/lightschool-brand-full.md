---
name: Light School
description: A dark, cosmic, hand-warmed learning brand for hands-on AI education — a starlit reading room where prismatic orbs drift behind quiet, restrained typography and softly-glowing gold buttons.
tags: [education, dark-ui, cosmic, sacred-geometry, prismatic, premium]

color:
  brand:
    gold:
      value: "#d4a037"
      rgb: "212, 160, 55"
      role: primary accent — buttons, focus rings, hover halos, "shine" highlights, affiliate codes
    gold-bright:
      value: "#e8c476"
      role: lifted gold for shine-word headlines and gradient stops
    gold-deep:
      value: "#b8862e"
      role: darker stop for gold gradients on solid CTAs
    purple:
      value: "#a78bfa"
      rgb: "167, 139, 250"
      role: secondary accent — links in long-form content, list bullets, FAQ icons, code-tag fills
    pink:
      value: "#e06b8a"
      rgb: "224, 107, 138"
      role: tertiary accent — error states, "negative" list dashes, rotating card glows
    cyan:
      value: "#00bcd4"
      rgb: "0, 188, 212"
      role: tertiary accent — flower-of-life sigil, background orb halos, rotating card glows
    indigo-soft:
      value: "#818cf8"
      rgb: "129, 140, 248"
      role: rare canvas-only orbital tint
    green:
      value: "#4caf50"
      rgb: "76, 175, 80"
      role: success states, active membership badges, "copied" confirmations
    amber:
      value: "#ff9800"
      rgb: "255, 152, 0"
      role: cancelled / warning status badges
    coral:
      value: "#e8b44a"
      role: hover state for solid gold buttons (newsletter form)

  background:
    base:
      value: "#050208"
      role: near-black indigo body — the night sky behind everything
    nav:
      value: "rgba(5, 2, 8, 0.85)"
      role: nav bar, frosted backdrop above starfield
    nav-mobile:
      value: "rgba(5, 2, 8, 0.92)"
    overlay:
      value: "rgba(5, 2, 8, 0.95)"
      role: campus gate / paywall overlays — backdrop-filter: blur(8px)
    code-block:
      value: "rgba(0, 0, 0, 0.4)"
    code-block-hover:
      value: "rgba(0, 0, 0, 0.5)"
    surface-card:
      value: "transparent"
      role: cards default to transparent so the background canvas shows through; only borders contain them
    surface-card-hover-gold:
      value: "rgba(212, 160, 55, 0.04)"
    surface-card-hover-white:
      value: "rgba(255, 255, 255, 0.02)"
    surface-input:
      value: "rgba(255, 255, 255, 0.05)"
    surface-portal-card:
      value: "rgba(255, 255, 255, 0.03)"
    surface-portal-card-hover:
      value: "rgba(255, 255, 255, 0.05)"
    surface-portal-primary:
      value: "rgba(212, 160, 55, 0.06)"
    surface-portal-primary-hover:
      value: "rgba(212, 160, 55, 0.10)"
    surface-affiliate:
      value: "rgba(212, 160, 55, 0.08)"

  text:
    primary:
      value: "#ffffff"
      role: headings, hero copy, button labels
    secondary:
      value: "rgba(255, 255, 255, 0.82)"
      role: body paragraphs in heroes and articles
    muted:
      value: "rgba(255, 255, 255, 0.62)"
      role: card descriptions, supporting copy
    faint:
      value: "rgba(255, 255, 255, 0.52)"
      role: footer brand tagline, eyebrow caption
    label:
      value: "rgba(255, 255, 255, 0.55)"
      role: stat labels, dates, weekday text
    placeholder:
      value: "rgba(255, 255, 255, 0.40)"
    on-gold:
      value: "#050208"
      role: text rendered on top of solid gold buttons — flips dark for contrast

  border:
    hairline:
      value: "rgba(255, 255, 255, 0.06)"
      role: nav under-rule, footer dividers, schedule-row separators
    card:
      value: "rgba(255, 255, 255, 0.08)"
      role: default card border
    card-hover:
      value: "rgba(255, 255, 255, 0.18)"
    card-hover-gold:
      value: "rgba(212, 160, 55, 0.30)"
    input:
      value: "rgba(255, 255, 255, 0.12)"
    input-focus:
      value: "rgba(212, 160, 55, 0.40)"

  selection:
    background: "rgba(212, 160, 55, 0.28)"
    text: "#ffffff"
    text-shadow:
      - "0 0 10px rgba(212, 160, 55, 0.6)"
      - "0 0 30px rgba(167, 139, 250, 0.2)"

gradient:
  shine-word:
    type: linear
    angle: "135deg"
    stops:
      - "#d4a037"
      - "#e06b8a"
      - "#a78bfa"
    role: "the trademarked tri-tone heat ramp on the word 'super power' — animated background-position for a slow shimmer (gradient-shift, 6s)"
  hero-orb-primary:
    type: radial
    shape: ellipse-at-center
    stops:
      - "rgba(0, 188, 212, 0.08) 0%"
      - "rgba(167, 139, 250, 0.04) 30%"
      - "rgba(212, 160, 55, 0.02) 50%"
      - "transparent 70%"
    role: 700px breathing aurora behind hero — pulses 8s ease-in-out
  hero-orb-secondary:
    type: radial
    shape: ellipse-at-center
    stops:
      - "rgba(212, 160, 55, 0.06) 0%"
      - "rgba(0, 188, 212, 0.03) 40%"
      - "transparent 65%"
    role: 500px counter-orb, offset 2s for parallax breath
  blockquote:
    type: linear
    angle: "135deg"
    stops:
      - "rgba(167, 139, 250, 0.08)"
      - "rgba(212, 160, 55, 0.06)"
    role: pull-quote tile in long-form content
  demo-section:
    type: linear
    angle: "135deg"
    stops:
      - "rgba(167, 139, 250, 0.08)"
      - "rgba(0, 188, 212, 0.06)"
  gold-button:
    type: linear
    angle: "135deg"
    stops:
      - "#d4a037"
      - "#b8862e"
    role: solid CTA in portal and affiliate copy buttons
  testimonial-quote-mark:
    type: linear
    angle: "135deg"
    stops:
      - "rgba(212, 160, 55, 0.25)"
      - "rgba(167, 139, 250, 0.20)"
    role: oversized opening curly quote behind testimonial
  fade-mask-marquee:
    type: linear
    angle: "to right"
    stops:
      - "transparent"
      - "black 8%"
      - "black 92%"
      - "transparent"
    role: edge fade for builders marquee

typography:
  font-family:
    display:
      stack: "'Gilroy', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
      role: all UI text — headings, body, buttons
    mono:
      stack: "'Monaco', 'Menlo', 'Ubuntu Mono', 'Courier New', monospace"
      role: code blocks, kbd keys, OTP inputs, affiliate codes
    serif:
      stack: "Georgia, 'Times New Roman', serif"
      role: oversized opening quote glyph in testimonials only

  font-weight:
    regular: 400   # default body, all hero & section H1/H2
    medium: 500
    semibold: 600  # logo, card titles, button primary, list counters, kbd
    bold: 700      # large stat numbers, .logo, hero meta values

  font-size:
    hero-h1:        { value: "clamp(2.8rem, 6.5vw, 4.5rem)" }
    section-h1:     { value: "clamp(2rem, 5vw, 3.2rem)" }
    section-h2:     { value: "clamp(1.8rem, 4vw, 2.5rem)" }
    post-h2:        { value: "2rem" }
    post-h3:        { value: "1.5rem" }
    post-h4:        { value: "1.25rem" }
    hero-subtitle:  { value: "1.35rem" }
    body-large:     { value: "1.2rem" }
    body:           { value: "1.08rem", role: "long-form prose default" }
    body-default:   { value: "1.05rem" }
    body-card:      { value: "1rem" }
    base:           { value: "0.95rem" }
    small:          { value: "0.85rem" }
    micro:          { value: "0.78rem" }
    eyebrow:        { value: "0.75rem" }
    stat-display:   { value: "3rem", role: "date-card .day, large numerics" }
    stat-value:     { value: "2.5rem", role: "hero meta values" }

  line-height:
    tight: 1.15      # post titles
    title: 1.2       # hero, section H2
    snug: 1.3        # blog card titles
    relaxed: 1.6     # default body, base
    paragraph: 1.7   # learn-card, post lists
    article: 1.85    # post body paragraphs (most generous)
    quote: 1.95      # testimonial blockquotes

  letter-spacing:
    display: "-0.035em"     # hero h1 — drawn in tight
    section: "-0.03em"      # post titles
    heading: "-0.02em"      # section h2, post h2
    subheading: "-0.01em"   # post h3
    label: "0.04em"
    eyebrow: "0.08em"
    eyebrow-loud: "0.12em"
    eyebrow-louder: "0.15em"
    otp: "0.5em"

  text-transform:
    eyebrow: uppercase   # all dates, stat labels, footer columns, tags

  font-style:
    italic-emphasis: "italic, color rgba(167, 139, 250, 0.85)"
    italic-quote: "italic, line-height 1.95"

spacing:
  scale:
    "0": "0"
    "1": "4px"
    "2": "8px"
    "3": "12px"
    "4": "16px"
    "5": "20px"
    "6": "24px"
    "7": "28px"
    "8": "32px"
    "10": "40px"
    "12": "48px"
    "14": "56px"
    "16": "64px"
    "18": "72px"
    "20": "80px"
    "24": "96px"
    "30": "120px"
    "40": "160px"

  container:
    narrow: "480px"   # portal login, gate
    reading: "640px"  # blockquote, includes-grid, FAQ, promise card
    article: "760px"  # post body
    default: "800px"  # base container max-width
    portal: "720px"   # portal dashboard
    grid-mid: "900px" # blog grid, post-nav
    grid-wide: "960px" # pathway grid, what-we-do row

  section-padding:
    y-default: "120px 0"
    y-tight: "80px 0"
    y-hero: "140px 0 80px"
    y-post-hero: "160px 0 100px"

  container-padding-x:
    desktop: "24px"
    mobile-tight: "16px"

  card-padding:
    snug: "20px"
    default: "28px"
    cozy: "32px"
    spacious: "40px"
    luxe: "48px"

radius:
  none: "0"
  sm: "5px"      # inline code chips
  base: "6px"    # newsletter inputs/buttons, payout buttons
  md: "8px"      # portal inputs, error/success boxes
  lg: "12px"     # code blocks, post images, portal quick cards
  xl: "14px"     # portal primary CTA
  "2xl": "16px"  # all primary cards (audience, pathway, blog, setup)
  pill: "20px"   # tag chips
  full: "100px"  # buttons, tool tags, status badges
  circle: "50%"  # orbs, planets, separators

elevation:
  shadow:
    none: "none"
    glow-card-default:
      value: "0 0 24px rgba(var(--glow), 0.08), 0 8px 32px rgba(0, 0, 0, 0.2)"
      role: blog card hover — soft chromatic aura plus drop shadow
    glow-portal-cta:
      value: "0 0 32px rgba(212, 160, 55, 0.10), inset 0 0 32px rgba(212, 160, 55, 0.03)"
      role: portal primary CTA hover — outer glow with inner gold mist
    glow-orb-hover:
      value: "0 8px 40px rgba(var(--node-color), 0.15)"
      role: skill-tree orb hover
    glow-nav-link:
      value: "0 0 12px rgba(212, 160, 55, 0.4)"
      role: nav links — applied as text-shadow on hover
    glow-logo:
      value: "0 0 16px rgba(212, 160, 55, 0.4)"
      role: site logo wordmark hover
    glow-button-pulse:
      role: pseudo-element halo behind .btn-primary — blurred 18px gold cushion that pulses 5s
      filter: "blur(18px)"
      color: "rgba(212, 160, 55, 0.35)"
      hover-filter: "blur(24px)"
    glow-post-nav:
      value: "0 0 20px rgba(212, 160, 55, 0.08)"

  blur:
    overlay-backdrop: "8px"     # campus gate
    button-halo: "18px"         # btn-primary idle
    button-halo-hover: "24px"   # btn-primary hover
    line-glow: "4px"            # skill-tree connecting lines

motion:
  ease:
    out-expo: "cubic-bezier(0.16, 1, 0.3, 1)"   # premium scroll reveals & card lifts
    standard: "ease"
    standard-out: "ease-out"
    standard-in-out: "ease-in-out"
    linear: "linear"

  duration:
    fast: "150ms"
    quick: "200ms"
    base: "250ms"
    smooth: "300ms"
    cinematic: "400ms"
    reveal: "800ms"     # scroll-reveal opacity/translate
    long: "1000ms"      # legacy reveal-on-scroll

  transition:
    color: "color 0.3s"
    border: "border-color 0.3s ease"
    card: "all 0.4s ease"
    cinematic-card: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)"
    button: "all 0.3s ease"

  keyframes:
    btn-pulse:
      duration: "5s"
      easing: ease-in-out
      iteration: infinite
      role: "primary CTA — gentle gold cushion breathes 0.97↔1.02 scale, 0.45↔0.85 opacity"
    btn-pulse-hover:
      duration: "4s"
      role: "tightens to 1.0↔1.04 with brighter opacity on hover"
    hero-orb-pulse:
      duration: "8s"
      easing: ease-in-out
      iteration: infinite
      role: "hero background orbs — scale 1↔1.08, opacity 1↔0.7"
    gradient-shift:
      duration: "6s"
      iteration: infinite
      role: "background-position 0%↔100% on tri-tone gradient text"
    sacredFloat:
      duration: "80s / 100s / 120s"
      easing: linear
      iteration: infinite
      role: "Metatron, Sri Yantra, Flower of Life slowly rotate 0→360°, staggered with negative delays"
    energyFlow:
      duration: "2.5s"
      easing: linear
      iteration: infinite
      role: "skill-tree connector dashes scroll −48px stroke-dashoffset, like power flowing between nodes"
    innerGlow:
      duration: "5s"
      easing: ease-in-out
      iteration: infinite
      role: "orb inner halo opacity 0.5↔1"
    outerHalo:
      duration: "8s"
      easing: ease-in-out
      iteration: infinite
      role: "orb outer halo opacity 0.4↔0.8, scale 0.95↔1.05"
    nodeReveal:
      duration: "0.8s"
      easing: ease
      role: "skill-tree nodes fade in & scale 0.7→1, staggered 200ms each"
    beckon:
      duration: "2s"
      iteration: 3
      role: "first skill-tree node gently pulses 1↔1.08 on load to invite click"
    scroll-proof:
      duration: "70s"
      easing: linear
      iteration: infinite
      role: "builders marquee track translates 0 → −50%"
    fade-in-up:
      from: "opacity 0, translateY(30px)"
      to: "opacity 1, translateY(0)"

  hover-lift:
    card-default: "translateY(-4px)"
    button-primary: "translateY(-2px)"
    portal-cta-arrow: "translateX(4px)"
    orb-scale: "scale(1.10)"
    next-lesson-scale: "scale(1.08)"

icons:
  source: The Noun Project — line style only (never solid, never emoji)
  color: monochrome white SVGs, recolored via CSS filters
  base-treatment: "filter: invert(1) brightness(1.3) opacity(0.4-0.6)"
  hover-treatment: "filter: invert(1) brightness(1.5) opacity(0.85-0.95)"
  warm-treatment: "filter: invert(1) brightness(1.3) sepia(1) saturate(0.5) hue-rotate(15deg) opacity(0.6) drop-shadow(0 0 10px rgba(212, 160, 55, 0.3))"
  sizes:
    micro: "32px"     # post-nav, portal quick card
    small: "40px"     # case studies, portal card
    medium: "48px"    # pathway card, portal primary
    large: "56px"     # skill-tree orb interior
    xl: "64px"        # blog cards, setup hub, post hero

components:
  button:
    primary:
      background: "rgba(20, 18, 14, 0.85)"
      border: "1px solid rgba(212, 160, 55, 0.25)"
      radius: "100px"
      padding: "14px 32px"
      text: "uppercase, 0.95rem, 600, letter-spacing 0.04em"
      halo: "::before pseudo, blur(18px) gold pillow, animated 5s pulse"
      hover: "background lifts to rgba(28, 24, 18, 0.95), border to gold/0.45, translateY(-2px), halo brightens"
    secondary:
      background: transparent
      border: "1px solid rgba(255, 255, 255, 0.20)"
      hover-border: "rgba(255, 255, 255, 0.50)"
    solid-gold:
      gradient: "135deg, #d4a037 → #b8862e"
      text-color: "#050208"
      use: portal forms, affiliate copy, newsletter submit
  card:
    default:
      background: transparent
      border: "1px solid rgba(255, 255, 255, 0.08)"
      radius: "16px"
      hover-border: "rgba(255, 255, 255, 0.18)"
      hover-bg: "rgba(255, 255, 255, 0.02)"
      hover-lift: "translateY(-4px)"
    chromatic:
      role: "blog cards & some pathway cards — receive a randomized accent color via --glow CSS var, rotating through the 7-tone palette on each page load"
  tag:
    radius: "20px"
    background: "rgba(167, 139, 250, 0.10)"
    border: "1px solid rgba(167, 139, 250, 0.20)"
    text: "uppercase, 0.75rem, letter-spacing 0.05em"
  status-badge:
    radius: "20px"
    text: "uppercase, 0.75rem, 600, letter-spacing 0.05em"
    variants:
      active: "green/15% bg, green text, green/30% border"
      cancelled: "amber/15%"
      expired: "pink/15%"
      inactive: "red-500/15%"
  input:
    background: "rgba(255, 255, 255, 0.05–0.06)"
    border: "1px solid rgba(255, 255, 255, 0.10–0.12)"
    radius: "6–8px"
    focus-border: "rgba(212, 160, 55, 0.40)"
    focus-shadow: "0 0 0 2px rgba(212, 160, 55, 0.15)"
  code-inline:
    background: "rgba(167, 139, 250, 0.12)"
    color: "rgba(167, 139, 250, 0.95)"
    radius: "5px"
    padding: "3px 8px"
  code-block:
    background: "rgba(0, 0, 0, 0.40)"
    border: "1px solid rgba(167, 139, 250, 0.15)"
    radius: "12px"
    interaction: "click anywhere to copy; copy-button at top-right with gold→green ✓ feedback"
  blockquote:
    background: "linear-gradient 135deg, purple/8% → gold/6%"
    border-left: "4px solid rgba(167, 139, 250, 0.50)"
    radius: "0 12px 12px 0"
    decoration: "oversized serif quote glyph at top-left in purple/20%"
  faq:
    divider: "1px solid rgba(255, 255, 255, 0.06)"
    icon: "purple +/× that rotates 45° on open"
    answer: "max-height 0→scrollHeight, 300ms ease"
  orb:
    role: "the brand's signature object — used for skill-tree nodes and next-lesson chips"
    shape: circle
    background: "radial-gradient at 40% 35%, node-color/25 → 8 → 2 → transparent"
    border: "1px solid node-color/40%"
    halos: "::before inner pulsing glow + ::after outer blurred bloom (12px blur)"
    sizes: { small: 80px, default: 100–110px, large: 150px }

layout:
  page-shell:
    canvas-layer: "fixed full-viewport z-0 — animated orbital rings & planets"
    sacred-geo-layer: "fixed z-0 — three rotating SVG sigils (Metatron purple top-left, Sri Yantra gold mid-right, Flower of Life cyan bottom-left)"
    content-layer: "z-1 — every body child sits above the cosmos"
    nav-layer: "z-1000 fixed top, frosted near-black"
  nav:
    height: "64px"
    border-bottom: "hairline white/6%"
  grid:
    blog-cards: "2 columns desktop, 1 column mobile"
    pathway: "3 columns desktop, 1 column mobile (max 400px)"
    setup-hub: "2 columns"
    portal-quick-links: "2 columns"
    dates: "2 columns; collapses to 1 if only one child"

breakpoints:
  mobile-large: "600px"
  tablet: "768px"
  small-phone: "480px"

z-index:
  canvas: 0
  content: 1
  campus-gate: 100
  nav: 1000
  mobile-menu: 9999
---

# Light School — Design System

## Identity in one sentence
Light School is a **cosmic, hand-warmed reading room** for hands-on AI education — a near-black night sky etched with rotating sacred geometry, lit by a slow-breathing prismatic orb, and grounded by gilded buttons that feel like lit candles in the dark.

The brand's central tension is **mysticism meets practicality**. Every page sits on top of an animated starfield with drifting planets and three rotating SVG sigils (Metatron's Cube in purple, the Sri Yantra in gold, the Flower of Life in cyan). On top of that cosmic backdrop, the foreground UI is unusually quiet — restrained typography, transparent cards, hairline borders, and generous breathing room. The cosmos does the emotional work; the type does the teaching.

## The look in five gestures

1. **The dark.** The page is `#050208` — not pure black but a very dark indigo with a hint of plum. It's warm enough to flatter gold and cool enough to make purple sing.
2. **The breath.** A pair of nested radial orbs (700px cyan→purple→gold, then 500px gold→cyan) pulse behind every hero on an 8-second cycle. A canvas-rendered orbital system of 6 concentric rings and 10 planets — gold, pink, purple, cyan, indigo, green — drifts at varying speeds across the whole page. Three SVG mandalas slowly rotate behind everything (80–120s revolutions, staggered).
3. **The gold.** `#d4a037` is the brand's primary candle. It appears as button borders with blurred halos that pulse, as focus rings on inputs, as the radial center of the portal's hero CTA, and as the third color in the trademark `gold → pink → purple` heat ramp that animates underneath the word "super power."
4. **The transparency.** Almost no card has a fill. They're defined by `rgba(255,255,255,0.08)` hairlines — a single pixel of glass. On hover, those hairlines warm to gold or warm white, the card lifts 4px, and a chromatic shadow blooms beneath it.
5. **The icons.** Every illustration is a Noun Project line icon, rendered white, then run through `invert(1) brightness(1.3) sepia(1) saturate(0.5) hue-rotate(15deg) opacity(0.6) drop-shadow(0 0 10px gold/30)` to emerge as a softly-lit warm-amber pictogram. On hover, brightness and drop-shadow lift them out of the page like a sigil being struck.

## Color philosophy

Light School runs a **5-color prismatic palette** layered onto a near-black ground:

| Role | Color | Use |
|---|---|---|
| Primary candle | gold `#d4a037` | every CTA accent, focus state, "shine" word, halos, sigil |
| Sage / link | purple `#a78bfa` | inline links, list bullet arrows, FAQ icons, code chips, italic emphasis |
| Heart / warning | pink `#e06b8a` | error states, "negative" list dashes, one of the rotating glow tones |
| Mind / wonder | cyan `#00bcd4` | flower-of-life sigil, hero orb inner ring, rotating glow tone |
| Growth / success | green `#4caf50` | success badges, copied-to-clipboard confirmation |

Cards that present **content** (blog posts, builder case studies) get a randomized chromatic glow chosen from a 7-tone palette including rose, mint orange, and sky blue — assigned at page load, persistent during the visit. This keeps the card grid alive and kaleidoscopic without committing to a single accent.

The `gold → pink → purple` linear gradient at 135° is the brand's **signature motion**: it appears on the word "Everybody" in the homepage hero, on the strong words inside testimonials, and on the testimonial's oversized opening quote. It animates `background-position` over 6 seconds for a slow, candle-flicker shimmer.

## Typography

The typeface is **Gilroy** with Inter as a workhorse fallback, both weights 300–800. Set big, set sparse, set in white-on-near-black. Headings are almost always **weight 400** — never bold — with tightly negative letter-spacing (`-0.035em` on hero, `-0.02em` on section heads). Body weight is also 400, color `rgba(255,255,255,0.82)`, with line-height tuned by context: **1.6 in tight UI**, **1.7–1.85 in articles**, **1.95 in testimonial blockquotes**.

The hierarchy descends in five steps:

- **Hero h1**: `clamp(2.8rem, 6.5vw, 4.5rem)`, weight 400, `-0.035em`, often with a single `<em>` set in the gold→pink→purple gradient.
- **Section h2**: `clamp(1.8rem, 4vw, 2.5rem)`, weight 400, `-0.02em`, centered, with a 72px lower margin and a 16px-spaced muted subtitle.
- **Card titles**: `1.15–1.35rem`, weight 600 — the rare moment heavier weight is used.
- **Body**: `1rem–1.08rem`, weight 400, line-height 1.7–1.85.
- **Eyebrow / label**: `0.75–0.85rem`, weight 500, **uppercase**, letter-spacing 0.08–0.15em, color `rgba(255,255,255,0.42–0.55)`. Used on stat labels, dates, "next lesson", and footer column headers.

Tabular numerics (`font-variant-numeric: tabular-nums`) appear in time columns of the schedule timeline.

For code, **Monaco / Menlo** in `0.92–0.98rem`, line-height 1.7–1.8. Inline code wears a purple chip (`rgba(167,139,250,0.12)` fill, purple/95% text). Code blocks are deep `rgba(0,0,0,0.4)` with a thin purple border and a top-right Copy button that flashes green when used.

## Layout & rhythm

The site is **center-justified and narrow**. The base `.container` is 800px wide. Long-form prose is even narrower (760px), reading copy 640px, and portal login a focused 480px. There are virtually no full-bleed sections — every block of content sits framed by the cosmic backdrop on either side.

Vertical rhythm is generous: **120px between sections**, 80px section-headers to first child, 40–48px between cards in a grid, 28–32px paragraph spacing in articles. Hero padding is the most luxurious at 140px top / 80px bottom.

Card grids are uniformly 2-column on desktop, collapsing to a single column under 768px. The pathway/services row is the only 3-column grid.

## Components in personality

- **Primary CTA buttons** are the room's lit candles. They're nearly black (`rgba(20,18,14,0.85)`), bordered in dim gold, set in uppercase 0.95rem with 0.04em tracking, and float a blurred gold pillow underneath via `::before`. That pillow pulses 0.45→0.85 opacity on a 5-second loop. On hover, it brightens, the button lifts 2px, and the border warms.
- **Date cards** put the day numeral huge (`3rem`, weight 700, line-height 1) above an uppercase weekday and a small button. They feel like Advent calendar tiles.
- **Skill tree nodes** are 150px **orbs** — radial-gradient spheres in a per-node accent color, with a pulsing inner glow and a 12px-blurred outer halo. They're arranged in a zigzag column with curved SVG bezier connectors that have animated dashed energy flowing along them at 2.5s. On hover, the orb scales 1.10, brightens, and casts a colored shadow.
- **Testimonials** are intentionally bare — italic 1.3rem white at 82% opacity, line-height 1.95 — but with an oversized 5rem opening quote glyph rendered in serif, set in a gold-purple gradient and clipped to text. The closing `<cite>` is muted, uppercase, tracked.
- **Builders marquee** is a horizontally-auto-scrolling band of 200×200 case-study tiles, masked with a `transparent → black 8% → black 92% → transparent` linear fade so cards drift in and out of view. It pauses on hover. Track speed is 70s for one full cycle.
- **Portal primary CTA** is the warmest object on the site: a 14px-radius gold-tinted card with a 0.35-opacity gold border, an inset radial glow at 20% 50%, and on hover a `0 0 32px gold/10%` outer aura plus a `inset 0 0 32px gold/3%` inner mist. The arrow icon translates +4px on hover.
- **FAQ** is just an unordered list separated by hairline white/6% rules. The toggle icon is a thin purple `+` that rotates 45° to become an `×` when open.
- **Sacred geometry** is rendered as inline SVG with `stroke-width: 0.5–2`, fill: none, opacity 0.28 (mobile 0.18). They sit `z-index: 0`, fixed, absolutely positioned at the corners. The three sigils never overlap each other and rotate at deliberately offset speeds (80s, 100s, 120s) so the page never feels mechanical.

## Motion language

Light School moves like a slow tide. Every animation is **multi-second, looping, and gently easing** — never punchy. The signature timing functions are:

- `cubic-bezier(0.16, 1, 0.3, 1)` (the "ease-out-expo" custom property) for premium card hovers and scroll reveals.
- Plain `ease` at 300–400ms for everything else.
- `linear` only for things that loop (mandala rotation, marquee, dashed line flow).

Scroll reveals fade and translate `30px → 0` over 800ms with a stagger of 80ms between siblings. Hovers lift cards 4px and lines 2px. The skill tree's first node is given a 3× repeating `beckon` animation (1↔1.08 scale over 2s) to gently invite the first click — it stops on its own.

`prefers-reduced-motion` is not yet honored explicitly, but every animation is decorative and the page is fully functional with motion paused.

## Accessibility & contrast notes

- White on `#050208` lands at >18:1 contrast for primary text and >12:1 for the 82% secondary text — both well above WCAG AA Large.
- The 62%-opacity muted text used in card descriptions hits ~10:1 on the base ground.
- Gold `#d4a037` on `#050208` hits ~9.5:1, so it's safe for buttons and standalone accent text.
- Buttons rely on a 1px gold border + halo for affordance rather than a fill. Inputs gain a 0.40-alpha gold border plus a 2px gold/15% outer ring on focus — strong enough for keyboard users, soft enough to fit the night-sky tone.

## Voice & content rules that shape design

- **No emoji, anywhere** — including cards, headings, copy. Every iconographic moment is a line-style Noun Project SVG.
- **No em dashes in long-form portal lessons.** Sentences are commas, colons, and periods only.
- Headlines lean to **3 words or fewer** when possible. The hero is "AI Is for *Everybody*. Including You." — short, gradient-weighted on the most important word.
- Copy is plain-spoken and physical. Words like "candle," "build," "ship," "real," "hands-on" recur. The visual system mirrors that: warm gold (candle), transparent cards (frame, not fill), hairline borders (sketch lines).

## Putting it together — a recipe for any new page

1. Lay the cosmic floor: `#050208` body, the canvas-orbits script, three sacred-geo SVGs at 8% top-left, 40% mid-right, 8% bottom-left.
2. Drop a hero with a 700px cyan-purple-gold radial orb pulsing behind it. Set the headline at `clamp(2.8rem, 6.5vw, 4.5rem)`, weight 400, with one word wrapped in `<em>` and given the tri-tone gradient.
3. Use 800px containers (or 760px for prose). Keep cards transparent with `rgba(255,255,255,0.08)` borders, 16px radius, 40px padding.
4. Reserve **gold** for one-and-only-one CTA per section. Reserve **purple** for inline links, italic emphasis, and code. Reserve **cyan** for ambient orb tints. Reserve **pink** for emotional or error moments.
5. Animate slowly. 6–8 second loops on background motion. 400ms cubic-out-expo on hover lifts. Never bouncier than that.
6. End with a footer CTA section featuring a `shine-word` (the gradient-clipped word "Power") and two opposing buttons — one primary gold-haloed, one ghost.

The result should feel like sitting in a warmly-lit room at night, with a window onto a slowly-turning galaxy. Quiet, gilded, technical, and a little magical.
