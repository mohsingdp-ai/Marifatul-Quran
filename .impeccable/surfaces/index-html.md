---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: ["player.html"]
---

# Surface brief: app shell (index.html, player.html)

Scope: every surface of the PWA (home list, ayat view, word box, word cards, translation, player dock, menu, Settings, share sheets, shared-link player). Mode: Operate. Users: academy students and teachers, daily, phone-first, often offline.

## Direction contract
THESIS: a calm, modern study app in the quran.com / Tarteel class: soft tinted ground, white rounded cards, one sage accent. Refuses the old saturated teal app bar with gold rule, Material state chrome, and any themed metaphor.
OWN-WORLD: misty sage ground (#eef3f1 light, #111715 dark), white 20px-radius cards, sage accent (#33695a / #8fcdb9) on soft sage tint, gentle pastel status chips (Memorized green, Playing lilac, Heard neutral), pill buttons, Rubik bundled, near-flat soft shadows, no coloured header bands.
STORY: the student sees which para they are in, how much is memorized, and one obvious Play per ruku; opening a ruku shows the ayat on one quiet sheet where the reciting ayah sits in a soft sage card with its key pill.
FIRST VIEWPORT: plain top bar (ق icon, name, install, menu); a sideways-scrolling row of para chips (number + name) with the current para filled sage; a progress ring card ("2 of 17 memorized", para Arabic name); then ruku cards: "Ruku n" + status chip, surah · ayah range, an action row with a Play/Pause pill and share, download, memorized icons. Docked player with rounded top at the bottom when a track is open.
FORM: canon (owner-steered modern product, round 3, direction 2 "Calm"); seed 7373f975.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Signature interaction: the reciting ayah's soft sage card follows the audio; status chips update live as rukus are heard, played, memorized.
Constraints: mushaf fonts fixed; UI font bundled (no CDN); Settings word-switch rows restyled only through shared tokens (PR #9 owns their markup); round-1 accessibility floor (44px targets on touch, dialogs, contrast, focus).
