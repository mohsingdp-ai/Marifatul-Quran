package com.mohsingdp.marifatulquran.ui.theme

import androidx.compose.ui.graphics.Color

// Web dark-theme tokens, lifted verbatim from style.css [data-theme="dark"].
// These are the single source of truth for the app's palette so the native UI
// matches the PWA pixel-for-pixel.
val TealDark = Color(0xFF062C2C)      // --teal-dark
val TealHeader = Color(0xFF0A3D3D)    // --teal-header
val TealAccent = Color(0xFF2DB4B4)    // --teal-accent
val TealLight = Color(0xFF122828)     // --teal-light
val CardBg = Color(0xFF141C1C)        // --row-white (card surface)
val RowGray = Color(0xFF101818)       // --row-gray
val PageBg = Color(0xFF0A1111)        // --page-bg
val TextPrimary = Color(0xFFE8F2F2)   // --text-primary
val TextMuted = Color(0xFF8FA8A8)     // --text-muted
val VerseLink = Color(0xFF5FD4D4)     // --verse-link  (mobile field labels + verses)
val ArabicGold = Color(0xFFD4B85C)    // --arabic-gold
val GoldDarkEnd = Color(0xFF6B5010)   // gold-gradient dark stop
val PlayingBg = Color(0xFF0F2C2C)     // --playing-bg
val Border = Color(0xFF2A3C3C)        // --border
val WaColor = Color(0xFF5FD4B4)       // --wa-color
val HeaderGoldEnd = Color(0xFF0F6060) // header gradient bright stop

// Hifz status-pill tokens (mirror the web dark chips).
val MutedChipBg = Color(0xFF222C2C)   // --muted-chip-bg (not started)
val WarnChipBg = Color(0xFF2C2418)    // --warn-chip-bg  (learning)
val WarnChipFg = Color(0xFFE0B878)    // --warn-chip-fg  (learning)
val SuccessBg = Color(0xFF153520)     // --success-bg    (memorized)
val SuccessFg = Color(0xFF7DD87D)     // --success-fg    (memorized)
