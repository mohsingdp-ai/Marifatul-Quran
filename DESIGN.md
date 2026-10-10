---
name: Marifatul Quran
description: A calm study app for the teacher's dars, ruku by ruku, with the mushaf following the voice.
colors:
  primary: "#33695a"
  on-primary: "#ffffff"
  primary-container: "#dcebe5"
  on-primary-container: "#123b31"
  tertiary: "#4a6a62"
  success-container: "#d6efe3"
  on-success-container: "#0f3d29"
  playing: "#e7e3f6"
  on-playing: "#4e4583"
  error: "#b3261e"
  error-container: "#fbe4e1"
  surface: "#eef3f1"
  card: "#ffffff"
  surface-container-low: "#f5f8f7"
  surface-container: "#e9efed"
  surface-container-high: "#e2eae7"
  on-surface: "#1a2925"
  on-surface-variant: "#5a6c67"
  outline: "#7d918b"
  outline-variant: "#dfe8e4"
  primary-dark: "#8fcdb9"
  on-primary-dark: "#0f1714"
  primary-container-dark: "#20332d"
  on-primary-container-dark: "#cdeee3"
  success-container-dark: "#1f3a2f"
  on-success-container-dark: "#b9f3d6"
  playing-dark: "#2a2740"
  on-playing-dark: "#c9c2f2"
  surface-dark: "#111715"
  card-dark: "#1a2320"
  raised-dark: "#212c28"
  on-surface-dark: "#e5eeeb"
  on-surface-variant-dark: "#9bb0a9"
  outline-dark: "#5f7670"
  outline-variant-dark: "#26322e"
typography:
  title:
    fontFamily: "Rubik, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 600
    lineHeight: "1.5rem"
  headline:
    fontFamily: "Rubik, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 400
    lineHeight: "1.75rem"
  body:
    fontFamily: "Rubik, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
    letterSpacing: "0.01em"
  label:
    fontFamily: "Rubik, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    lineHeight: "1.25rem"
    fontFeature: "tnum"
  chip:
    fontFamily: "Rubik, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: "1.375rem"
  mushaf:
    fontFamily: "IndoPak Nastaleeq, Traditional Arabic, Scheherazade New, Amiri, Noto Naskh Arabic, serif"
  urdu:
    fontFamily: "Noto Nastaliq Urdu, Traditional Arabic, serif"
rounded:
  xs: "6px"
  sm: "10px"
  md: "16px"
  lg: "20px"
  xl: "24px"
  full: "9999px"
spacing:
  card-gap: "10px"
  card-pad: "14px 8px 6px 16px"
  group-pad: "10px 20px"
  touch: "44px"
components:
  ruku-card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card-pad}"
  play-pill:
    backgroundColor: "{colors.primary-container}"
    textColor: "{colors.on-primary-container}"
    rounded: "{rounded.full}"
    height: "44px"
    padding: "0 18px 0 14px"
  play-pill-playing:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  para-chip:
    backgroundColor: "{colors.card}"
    textColor: "{colors.on-surface-variant}"
    rounded: "{rounded.full}"
    height: "44px"
  para-chip-selected:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
  status-memorized:
    backgroundColor: "{colors.success-container}"
    textColor: "{colors.on-success-container}"
    typography: "{typography.chip}"
    rounded: "{rounded.full}"
  status-playing:
    backgroundColor: "{colors.playing}"
    textColor: "{colors.on-playing}"
    typography: "{typography.chip}"
    rounded: "{rounded.full}"
  status-heard:
    backgroundColor: "{colors.surface-container-high}"
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.chip}"
    rounded: "{rounded.full}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.full}"
    height: "40px"
    padding: "0 24px"
  ayah-key-pill:
    backgroundColor: "{colors.surface-container}"
    textColor: "{colors.on-surface-variant}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    height: "32px"
  ayah-reciting:
    backgroundColor: "{colors.primary-container}"
    rounded: "{rounded.md}"
  settings-group:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.lg}"
  dialog:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
---

# Design System: Marifatul Quran

## Overview

**Creative North Star: "The Quiet Study Desk"**

A calm, modern study app in the quran.com / Tarteel class. Misty sage ground, white rounded cards, one sage accent, soft pastel status chips. The mushaf and the teacher's voice lead; the interface stays quiet around them. No coloured header bands, no themed cultural ornament.

Phone-first, one-handed, dense enough to show several rukus per screen. Light and dark are both first-class: every colour is a role token with a value per theme, never a hard-coded hex.

**Key Characteristics:**
- Tinted ground, white (light) or one-step-up (dark) cards.
- One accent: sage. Filled sage means "current" or "playing".
- Pills for every action and chip; 20px-radius cards.
- Near-flat; tone does the lifting, shadows are soft and low.
- Rubik for the UI, bundled; the mushaf keeps its own faces.

## Colors

Low-chroma sage neutrals with one sage accent and two pastel status hues. Tokens live as `--md-*` roles in `:root` and `html[data-theme="dark"]` in style.css; player.html mirrors the same values in its own short names (`--bg`, `--surface`, `--accent`, `--soft`, ...).

### Primary
- **Deep Sage** (light) / **Mint Sage** (dark): current para chip, Play pill while playing, reciting ayah's key pill, switches on, focus ring, filled buttons.
- **Sage Wash** (primary-container): resting Play pill, the reciting ayah's card, the playing card's 2px ring.

### Secondary
- **Soft Lilac** (playing / on-playing): the "Playing" status chip and the docked player's live badge only. Lilac so it never reads as "done".

### Tertiary
- **Muted Sage Ink** (tertiary): surah names, basmala, ayah markers, paused state. Quieter than the accent.

### Neutral
- **Misty Sage Ground** (surface): page and dialog ground; also the top bar (it has no band of its own).
- **Card White** (card): cards, settings groups, menus, popovers. In dark, card is one step up from ground, menus and the word popover one more (raised).
- **Sage Ink** / **Sage Grey** (on-surface / on-surface-variant): text and secondary text.
- **Hairline** (outline-variant): the only divider, e.g. between a ruku card and its open ayat panel.
- **Success / Error** containers: "Memorized" chip and danger buttons / failed-load state.

### Named Rules
**The One Accent Rule.** Sage is the only accent. Filled sage = current or playing; Sage Wash = available. Nothing else gets the accent.

**The Status Pastel Rule.** Status is said by a soft chip, never by recolouring the card: Memorized green, Playing lilac, Heard and Paused neutral. Later state wins (Heard < Memorized < Playing/Paused).

**The Two Themes Rule.** Any new colour ships as a role token with both a light and a dark value. player.html carries the same values.

## Typography

**UI Font:** Rubik 400/500/600, bundled as woff2 in asset/fonts (fallback system-ui, sans-serif).
**Mushaf Font:** IndoPak Nastaleeq (default), or the Uthmani stack (Traditional Arabic, Scheherazade New, Amiri, Noto Naskh Arabic), chosen in Settings; Indo-Pak Naskh uses the Uthmani faces.
**Urdu Font:** Noto Nastaliq Urdu over the Arabic stack, for translation and word glosses.

**Character:** a round, friendly sans for the chrome; the scripture keeps its traditional faces at a larger, user-scalable size (`--mushaf-scale`).

### Hierarchy
- **Headline** (400, 1.375rem/1.75rem): guide overlay titles.
- **Title** (600, 1.0625rem/1.5rem): app name, "Ruku n", progress card count.
- **Body** (400, 0.875rem/1.25rem, 0.01em): default text, menu items (500), settings rows.
- **Label** (600, 0.8125rem, tabular numerals): ayah key "2:3", counts, step labels.
- **Chip** (500, 0.75rem/1.375rem): status chips and badges.
- **Mushaf** (about 1.35 to 1.6rem x `--mushaf-scale`): ayat; Arabic surah and para names inline at 1.05rem.

### Named Rules
**The Fixed Mushaf Rule.** The mushaf faces (IndoPak Nastaleeq, Uthmani stack, Indo-Pak Naskh) are fixed. Never restyle, recolour or swap them; highlight with a wash behind the words, not colour on them.

**The Bundled Font Rule.** Every UI face ships inside the app. No Google Fonts, no CDN.

## Layout

Single column, max 860px, centred; 1rem phone gutter. Top bar, then a sideways-scrolling row of para chips that runs to the screen edges, then the progress ring card, then ruku cards stacked 10px apart. Ruku card is a grid: title + status chip and memorized check on top, surah line, then an action row (Play pill, ayat toggle, share, download); seek/speed open under it only on the playing card. Opening a ruku attaches the ayat panel under the card as one surface (card loses its bottom radius). Docked player pins to the bottom with safe-area padding; body adds bottom padding so the last ayah clears it. Breakpoints in use: 380px, 560px, 640/641px, 768px.

**The 44px Rule.** On coarse pointers every tappable control is at least 44x44px. Where the eye wants something smaller (32px ayah key pills), transparent borders outside the painted background carry the target to 44px.

## Elevation & Depth

Hybrid, mostly tonal. Cards sit on the tinted ground with a barely-there shadow; overlays climb the scale. Shadows are tinted sage-black in light and plain black, heavier, in dark, where tone does most of the work.

### Shadow Vocabulary
- **elevation-1**: ruku cards, progress card, ayat panel.
- **elevation-2**: added under the playing card's sage ring.
- **elevation-3**: menu dropdown, dialogs, guide caption.
- **elevation-4**: word popover.
- **dock**: docked player, cast upward.

**The Soft Lift Rule.** No hard or offset shadows, no borders as depth. Lift is soft, low and tinted.

## Shapes

Generous and round. Cards and settings groups 20px; dialogs, guide caption and docked player top 24px; menus, word cards, share rows, ayah blocks 16px; small badges 10px; every button, chip, segmented control and switch a full pill. App icon 9px.

## Components

### Buttons
- **Shape:** full pill, 40px min (44px on touch).
- **Primary:** filled sage; hover mixes 8% on-primary in and adds elevation-1.
- **Tonal (default .btn):** Sage Wash with dark sage text. **Danger:** error-container.
- **Icon buttons:** 40px, no chrome at rest, 8% state layer on hover. Press shows a ripple clipped to the control's shape.
- **Focus:** one 2px sage outline, offset 2px, keyboard only.

### Play / Pause pill
Signature control on every ruku card: 44px pill with icon and word. Sage Wash at rest; filled sage on the playing card. Label follows playback ("Play" / "Pause").

### Chips
- **Para chip:** 44px pill, number in a 32px round badge + name. Unselected: card on ground. Selected: filled sage, badge 22% on-primary.
- **Status chip:** after "Ruku n"; Heard / Memorized / Playing / Paused per the Status Pastel Rule.
- **Ayat toggle:** quiet outlined pill, "Ayah 1–7 ⌄".

### Cards
- **Ruku card:** 20px, card colour, elevation-1. Playing: keeps its colour, gains a 2px Sage Wash ring + elevation-2.
- **Progress card:** 52px conic ring (6px stroke, sage on surface-container-high) beside "n of m rukus memorized", para Arabic name and counts.
- **Word card:** 16px, ground colour inside the panel.

### Ayat sheet
Ayahs in 16px blocks. Each starts with an ayah key pill (play icon + "2:3"). The reciting ayah gets a Sage Wash block and a filled sage key pill; the wash follows the audio.

### Word popover
20px radius, raised colour, elevation-4, max 380px: the word with its sound button, transliteration, Urdu meaning, parts.

### Docked player
Same element as the toolbar strip, pinned bottom once the playing card scrolls away: card colour, 24px top corners, upward shadow, slides in (300ms emphasized). Shows play/pause, title, progress line, locate and menu.

### Menu, dialogs, guide
Menu: card colour, 16px, elevation-3, 48px rows, scales in from top right. Dialogs: real modal, ground colour, 24px, elevation-3, scrim, scale 0.94 to 1. Guide: spotlight + 24px caption card.

### Settings
Groups are cards (20px) on the dialog's ground, each with a 600 header and a sage icon. Segmented control: pill track on ground, chosen segment filled sage. Switch: 52x32, handle grows 16 to 24px and gains a check when on. Word-meaning switch rows are restyled only through these shared tokens and classes, never their markup.

### Share sheet
Rows are 16px card tiles, 52px min height, on the dialog ground.

### Motion
Standard easing cubic-bezier(0.2, 0, 0, 1), emphasized cubic-bezier(0.05, 0.7, 0.1, 1); 150ms short, 300ms medium. Reduced motion stops animation and hides ripples.

## Do's and Don'ts

### Do:
- **Do** use the `--md-*` role tokens for every colour, with light and dark values.
- **Do** make every touch control 44px on coarse pointers.
- **Do** put new surfaces on white/raised cards at 20px over the misty ground.
- **Do** say state with a pastel chip or a filled sage pill.
- **Do** ship any new UI face as a bundled woff2.

### Don't:
- **Don't** restyle, recolour or replace the mushaf faces.
- **Don't** load fonts from Google Fonts or any CDN.
- **Don't** add a coloured app bar, gold rules or themed ornament.
- **Don't** add a second accent colour; lilac is for "Playing" only.
- **Don't** use hard, offset or dark heavy shadows in light theme.
- **Don't** add small uppercase tracked labels above titles.
- **Don't** change the Settings word-switch rows' markup; restyle only via shared tokens/classes.
