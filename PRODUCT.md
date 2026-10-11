# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- Students of a Quran academy (Marifatul Quran) who replay their teacher's dars for each ruku, read along in the mushaf, look up word meanings and track what they have memorized.
- Teachers and academy staff, who use it every day as well: they share ruku links and recordings on WhatsApp, download paras, and check and correct ayah timings (Admin role).
- Urdu speakers, often on cheap Android phones, often offline or on metered data. The interface copy is English; the content is Arabic and Urdu.

## Product Purpose
Make the teacher's lesson for every ruku of the 30 paras playable anywhere, with the ayah being recited highlighted in the mushaf, so a student can follow, understand word by word, and memorize. Success is daily use: a lesson played, ayat followed, rukus marked memorized.

## Positioning
The academy's own teacher's voice, cut per ruku and aligned ayah by ayah to an Indo-Pak mushaf, with Urdu word meanings and morphology, all of it offline. Generic Quran apps carry reciters, not this teacher's dars.

## Operating Context
- Daily study sessions and revision, one-handed on a phone, sometimes in class or while commuting.
- Sharing a ruku link or audio file to class WhatsApp groups; shared links open a separate player page.
- Installed as a PWA; whole paras saved for offline use.

## Capabilities and Constraints
- Para picker (1–30), ruku cards with play, share, download and memorized; listen counts; hifz progress per para.
- Ayat view: mushaf in Indo-Pak Nastaleeq by default (Uthmani and Indo-Pak Naskh in Settings), ayah highlight following the audio, tap a word for its Urdu meaning, parts and grammar, and its sound; word cards; Urdu translation (Maududi).
- Docked player toolbar, playback modes (stop, loop, next), speed, volume, lock-screen notification.
- Admin: timing editor, uploads, AI grammar prompts.
- Fixed: the Quran text, translations, word data, audio and timings; the mushaf font faces. Any UI font must ship inside the app (no CDN).

## Brand Commitments
- Name "Marifatul Quran" and the gold ق app icon stay.
- Colours, type (outside the mushaf) and layout are free to change.
- Look (owner steer, 2026-10-10, after two rounds of themed directions): a modern, clean product UI in the class of quran.com and Tarteel — calm, spacious, soft colours, minimal chrome. No themed cultural metaphor.

## Evidence on Hand
Real content in the repo: verses.js, verses-indopak.js, timings.js, word meanings and morphology under asset/, Urdu translations, ruku audio. No testimonials or usage figures exist; none may be invented.

## Product Principles
1. The mushaf and the teacher's voice lead; everything else serves following along.
2. Works offline, on cheap phones, one-handed.
3. Students and teachers both use it daily; teacher tools stay reachable without crowding students.
4. Arabic and Urdu render correctly and right-to-left, always.

## Accessibility & Inclusion
WCAG AA contrast, 44 px touch targets, visible focus, real dialogs, light and dark themes, reduced motion respected.
