---
name: OguriCap-Bot Panel
description: Real-time WhatsApp bot administration panel. Control room aesthetic — precise, alive, dark.
colors:
  vital-signal-green: "#25d366"
  system-teal: "#2dd4bf"
  energy-rose: "#ff4d8d"
  alert-amber: "#f59e0b"
  phantom-violet: "#8b5cf6"
  ghost-mint: "#a7f3c7"
  void-black: "#080a09"
  carbon-surface: "#0e1210"
  spectral-white: "#f2f6f3"
  system-gray: "#849a8e"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(1.75rem, 4vw, 2.5rem)"
    fontWeight: 900
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 700
    lineHeight: 1.35
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.6
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 900
    letterSpacing: "0.15em"
  mono:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  xl: "28px"
  lg: "16px"
  md: "12px"
  sm: "8px"
  pill: "9999px"
spacing:
  card-pad: "24px"
  card-pad-sm: "20px"
  section-gap: "24px"
  content-gap: "16px"
components:
  button-primary:
    backgroundColor: "linear-gradient(135deg, {colors.vital-signal-green} 0%, {colors.system-teal} 100%)"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "linear-gradient(135deg, {colors.vital-signal-green} 0%, {colors.system-teal} 100%)"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "10px 20px"
  button-secondary:
    backgroundColor: "rgb(14 18 16 / 0.72)"
    textColor: "{colors.spectral-white}"
    rounded: "{rounded.lg}"
    padding: "10px 20px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.system-gray}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
  card-base:
    backgroundColor: "rgb(14 18 16 / 0.58)"
    rounded: "{rounded.xl}"
    padding: "{spacing.card-pad}"
  input-base:
    backgroundColor: "rgb(14 18 16 / 0.80)"
    textColor: "{colors.spectral-white}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
---

# Design System: OguriCap-Bot Panel

## 1. Overview

**Creative North Star: "The Control Room"**

This is not a dashboard. It is a control room: a place where a single operator monitors and commands a living system. Every surface carries weight. Every color is a signal. The void black background is not a style choice; it is the ambient darkness of a room where screens are the only light source. An administrator opening this panel at 2am to check why a subbot is silent needs information immediately, without visual noise, without decorative chrome.

The system breathes. The particle background shifts. Status indicators pulse. Data values animate on arrival. But none of that motion is gratuitous; it is evidence that the system is alive. When everything stops moving, something has gone wrong. This is the aesthetic logic of "preciso, vivo, oscuro."

The palette comes from meaning, not taste. Signal green (#25d366) is not a brand color; it is the color of a live connection. Teal (#2dd4bf) is a secondary readout. Energy rose (#ff4d8d) is an alarm. Amber (#f59e0b) is a caution state. These are not decorative; they are a status vocabulary. Using them outside that vocabulary dilutes the signal.

**Key Characteristics:**
- Deep void backgrounds; no surface lighter than Carbon Surface (#0e1210) except for text
- Color used as signal, not decoration; green means live, rose means alert
- Inter for all UI text; JetBrains Mono for data values, IDs, phone numbers
- Cards with mass: deep directional shadows + ambient neon halo at rest, amplified on hover
- Framer Motion with spring physics for arrivals; expo-out for exits
- Magnetic cursor pull on primary CTAs; ripple on click
- Particle field in the background: visible, non-intrusive, alive

## 2. Colors: The Signal Vocabulary

Color is a protocol, not a palette. Each hue carries a fixed semantic role. Introducing a color outside its role breaks the signal contract.

### Primary
- **Vital Signal Green** (#25d366, oklch(75% 0.20 152)): The color of a live WhatsApp connection. Used on online status indicators, primary CTAs, the active nav item, progress bars at completion, and the primary glow system. Its rarity preserves its meaning: if everything is green, nothing is.

### Secondary
- **System Teal** (#2dd4bf, oklch(78% 0.12 185)): Secondary data readouts, secondary CTAs, the "info" semantic, configuration-page primary. It pairs with green in the main gradient (gradient-oguri-primary). Used in secondary glows and as the info state color.

### Tertiary
- **Energy Rose** (#ff4d8d, oklch(62% 0.24 355)): The alarm color. Danger states, high-severity alerts, the "energy" signal in mixed glows. Appears on fewer than 5% of any given screen. When it appears, the user must notice it.
- **Alert Amber** (#f59e0b, oklch(76% 0.17 76)): Warning states, pending actions, amber status badges. Never used decoratively.
- **Phantom Violet** (#8b5cf6, oklch(56% 0.22 275)): Used only on specific page contexts (page-e slot) and the loading/auth spinner gradient. Not a general accent.
- **Ghost Mint** (#a7f3c7, oklch(87% 0.07 152)): Softer green; used for "lavender" role tokens and as a muted echo of Vital Signal Green in hover states and subtle tints.

### Neutral
- **Void Black** (#080a09): The deepest background layer. Tinted toward green at chroma 0.005; never pure black.
- **Carbon Surface** (#0e1210): Elevated surfaces, cards, panels. The "card" background token.
- **Spectral White** (#f2f6f3): Primary text. Tinted toward green; never pure white.
- **System Gray** (#849a8e): Muted text, secondary labels, empty states. The visual whisper.

### Named Rules
**The Signal Protocol Rule.** Green means live. Rose means critical. Amber means caution. Teal means info. Using any of these four colors outside their semantic role is prohibited. Decorative green buttons on a disconnected bot are a lie.

**The Void Tint Rule.** No surface is pure black (#000000) or pure white (#ffffff). Every neutral leans toward the brand hue at chroma 0.005-0.01. The darkness feels intentional, not absent.

## 3. Typography

**Display Font:** Inter, system-ui, sans-serif
**Body Font:** Inter, system-ui, sans-serif
**Data/Mono Font:** JetBrains Mono, monospace

**Character:** A single-weight-family system with extreme contrast between roles. Inter at weight 900 for display and labels, weight 500 for body. The mono stack appears whenever the content is a data value — phone numbers, IDs, timestamps, counts — making the distinction between UI text and data immediate and scannable.

### Hierarchy
- **Display** (900, clamp(1.75rem, 4vw, 2.5rem), 1.05, letter-spacing -0.02em): Page titles, hero numbers. Used once per view maximum.
- **Headline** (800, 1.25rem, 1.2, letter-spacing -0.01em): Section headers, card titles (CardTitle). The primary content anchor.
- **Title** (700, 1rem, 1.35): Subsection labels, table headers, modal titles.
- **Body** (500, 0.875rem, 1.6): All paragraph text, descriptions, form labels. Cap at 65ch for readability.
- **Label** (900, 0.6875rem, letter-spacing 0.15em, UPPERCASE): Stat card category tags, nav item labels, badge text. The blackletter shout in miniature.
- **Mono** (JetBrains Mono 500, 0.8125rem, 1.5): Phone numbers, JIDs, timestamps, numeric metrics in stat cards, log entries. Never for labels or headings.

### Named Rules
**The Data Slot Rule.** Any value that comes from the API (count, ID, phone number, timestamp) renders in JetBrains Mono. UI chrome (labels, nav, headings) renders in Inter. The contrast between them is the grammar of the interface.

**The Weight Ladder Rule.** Body (500) to Label (900) is a jump of 400. Body (500) to Headline (800) is 300. No two adjacent elements in the hierarchy may share a weight.

## 4. Elevation

This system does not use flat surfaces. Every card, panel, and modal sits in a physically plausible space; the darkness below it proves it is lifted.

Elevation has two components working together: a deep directional shadow that establishes height, and an ambient neon halo that identifies the element's semantic role. A status card at rest has a deep shadow plus a faint green halo; on hover, both amplify. A modal has no neon halo; it has only mass.

### Shadow Vocabulary
- **Card Rest** (`0 24px 70px -36px rgba(0,0,0,0.28)`): Applied to all Card and StatCard components at rest. Diffuse, heavy base lift.
- **Card Hover** (`0 28px 80px -34px rgba(0,0,0,0.82), 0 0 42px rgba(127,180,255,0.10)`): Amplified on hover. The lift increases; a cold blue ambient appears.
- **Glow Primary** (`0 0 20px rgba(37,211,102,0.55), 0 0 40px rgba(37,211,102,0.26)`): Green neon halo for primary CTA buttons and active state elements.
- **Glow Mixed** (`0 0 15px rgba(37,211,102,0.46), 0 0 30px rgba(45,212,191,0.34), 0 0 45px rgba(255,77,141,0.16)`): Tricolor halo. Used on glow-variant buttons and pulsing active stat cards. The system's visual signature.
- **Glow Cosmic** (`0 0 24px rgba(37,211,102,0.38), 0 0 54px rgba(45,212,191,0.22), 0 0 96px rgba(255,77,141,0.14)`): Wider diffusion; for large hero panels and the main card at full attention.
- **Input Focus** (`0 15px 45px rgba(37,211,102,0.12), 0 0 0 2px rgba(37,211,102,0.18)`): Two-part: ambient drop + inline ring. Applied on `:focus-visible` for all text inputs.

### Named Rules
**The Two-Layer Elevation Rule.** Every elevated surface has two shadow layers: a dark directional layer (height) and a colored halo layer (identity). Using only one of the two produces a floating object with no character, or a colored blob with no weight.

**The Rest-to-Active Amplification Rule.** Shadows at rest are subtle. On hover or active state, both layers amplify simultaneously; the directional shadow deepens and the halo brightens. This is the mechanism that makes the system feel responsive without a single color change.

## 5. Components

### Buttons

Fluido y potente: responses have mass and spring physics. Arrivals ease-out-expo. Primary buttons carry magnetic attraction toward the cursor at close range.

- **Shape:** Rounded corners, 16px radius (rounded-2xl). Not pill; not sharp. Controlled.
- **Primary:** `gradient-oguri-primary` background (green → teal at 135deg), white text, `shadow-glow-oguri-purple` at rest. `shadow-glow-oguri-mixed` on hover. Scale 1.015 on hover (spring, stiffness 180, damping 20). Scale 0.985 on press. Magnetic cursor pull within 40px for large variants. Ripple effect on click (positioned at cursor).
- **Secondary:** `border border-border/20 bg-card/72`, foreground text. Border lifts to `border/40` on hover; `shadow-glow` appears. Same spring scale.
- **Ghost:** Transparent bg, system-gray text. Hover: `bg-white/10`, text lifts to text-primary. No glow. No shadow.
- **Danger:** `bg-red-500/12 border-red-500/25`, red-400 text. Hover: `bg-red-500/20`, border intensifies.
- **Disabled:** `opacity-50`, pointer-events none. No hover state.

### Cards / Containers

- **Corner Style:** 28px radius (rounded-[28px]). All card variants use this uniformly.
- **Background:** `bg-card/58` (Carbon Surface at 58% opacity) with `backdrop-blur-xl`.
- **Shadow Strategy:** Card Rest shadow + primary ambient halo. See Elevation section.
- **Border:** `border border-border/15` at rest; lifts to `border-primary/25` on hover.
- **Internal Padding:** 24px (p-6) standard; 20px (p-5) for stat cards and compact variants.
- **Interior layers (always present):** (1) radial gradient from top at primary/12%, (2) gradient-to-br white/3% overlay, (3) fine grid texture at 6% opacity 24px, (4) top-edge shine: 1px horizontal gradient via-white/20. These create the layered "glass with depth" look without relying on blur as the primary signal.
- **StatCard additionally:** Mouse-tracked 3D tilt (±6deg Y, ±4deg X via CSS vars). Spotlight radial gradient follows cursor. On hover, top-edge streak in variant color appears.

### Inputs / Fields

- **Style:** `border border-border/18 bg-card/80`, 12px radius, 12px 16px padding. Dark fill, thin border.
- **Focus:** Primary ring `0 0 0 2px rgba(37,211,102,0.18)` + ambient drop `0 15px 45px rgba(37,211,102,0.12)`. Animated in via `inputFocusGlow` keyframe (300ms ease-out-expo). Border lifts to `border-primary/50`.
- **Error:** Red ring variant (`danger` semantic). Same animation pattern, red values.
- **Disabled:** 50% opacity, cursor not-allowed.

### Navigation (Sidebar)

- **Style:** Full-height sidebar, `bg-card/90 backdrop-blur-2xl`, border-right `border-border/12`. Not a drawer; always visible on desktop.
- **Nav items:** Icon + label. Default: `text-muted` icon and text. Hover: text lifts to `text-secondary`. Active: `bg-primary/12 text-primary`, left-edge indicator replaced by background tint (no side-stripe border above 1px).
- **Active indicator:** A 2px full-height left-edge mark is permitted here at exactly 2px as a primary line, not a decorative stripe.
- **Typography:** Label (900, 0.6875rem, 0.15em tracking, UPPERCASE) for section group headers; Title weight for individual items.

### Status Indicators

The system's most critical micro-component. A pulsing dot communicates live connection.

- **Online (green):** `bg-vital-signal-green`, `animate__heartBeat animate__infinite animate__slow`. Double-pulse rhythm. Ring around the dot glows at `shadow-glow-oguri-purple`.
- **Connecting (amber):** `bg-alert-amber`, `animate__pulse animate__infinite`. Steady pulse.
- **Offline (gray):** Static `bg-system-gray`. No animation.
- **The rule:** The animation IS the status. Stopping the animation signals disconnection even before color is processed.

### Navigation Badge (Unread count)

- **Style:** `bg-red-500`, `text-white`, `rounded-pill`, 16x16px minimum. `shadow-[0_0_10px_rgba(239,68,68,0.7)]` red glow.
- **Entrance:** Spring animation (`stiffness 420, damping 16, rotate: 30deg → 0deg, scale: 0 → 1`). Re-triggers on each new count (`key={unreadCount}`).

## 6. Do's and Don'ts

### Do:
- **Do** use Void Black (#080a09) or Carbon Surface (#0e1210) as every background. No surface goes lighter than Carbon Surface except text.
- **Do** use JetBrains Mono for any value that comes from the API: counts, phone numbers, IDs, timestamps. Inter for UI chrome.
- **Do** apply the two-layer elevation rule: directional shadow + colored halo together on every elevated surface.
- **Do** let status indicator pulse animations do the semantic work. Color alone is not enough; motion confirms the state.
- **Do** use `cubic-bezier(0.16, 1, 0.3, 1)` (ease-out-expo) for all entrances. Use `cubic-bezier(0.7, 0, 0.84, 0)` for exits only.
- **Do** keep green (#25d366) reserved for live-connection semantics. A "submit" button in green is appropriate because submitting activates a live process. A decorative divider in green is not.
- **Do** vary card padding for rhythm: 24px standard, 20px compact, 32px hero. Same padding everywhere is monotony.

### Don't:
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe on cards, list items, or alerts. Use full borders, background tints, or leading icons instead.
- **Don't** use `background-clip: text` with gradient backgrounds. Gradient text is decorative, never meaningful. Single solid color for text; emphasis through weight or size.
- **Don't** use glassmorphism as a default. `backdrop-blur` appears only on cards, sidebar, and modals where the content beneath is genuinely relevant context. A blurred decorative blob is not glass.
- **Don't** build identical card grids with icon + heading + body text repeated across a screen. If a set of items deserves a grid, vary the hierarchy: lead with a signature item, follow with smaller cards.
- **Don't** render a modal as the first solution to a user action. Exhaust inline expansion, side panel, or contextual popover alternatives before opening a modal.
- **Don't** use the hero-metric template (huge number, tiny label, gradient accent bar). This is a SaaS cliché. Use StatCard's full composition: title, value in mono, subtitle, trend badge, icon.
- **Don't** let the interface feel generic. If it could be the admin panel for any SaaS product, it has failed. The personality is "preciso, vivo, oscuro" — if it feels like Notion or Linear's calm, add signal. If it feels like a crypto exchange's chaos, remove noise.
- **Don't** animate CSS layout properties (width, height, padding, margin, top, left). Animate transform and opacity only.
- **Don't** use bounce or elastic easing outside of deliberately delightful micro-moments (notification badge entrance, jackInTheBox). The system is tense, not playful.
