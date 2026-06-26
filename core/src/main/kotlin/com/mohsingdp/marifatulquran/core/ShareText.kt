package com.mohsingdp.marifatulquran.core

import java.net.URLEncoder

/**
 * Build a player deep link for the given ruku.
 * Uses URLEncoder.encode (form encoding) so that '+' in ruku IDs becomes '%2B',
 * matching web URLSearchParams behaviour.
 */
fun playerDeepLink(ruku: Ruku, base: String = PAGES_BASE): String {
    val encodedRuku = URLEncoder.encode(ruku.rukuInPara, "UTF-8")
    return base.trimEnd('/') + "/player.html?para=" + ruku.para + "&ruku=" + encodedRuku
}

/**
 * Caption for sharing a ruku: a one-line title followed by the deep link.
 * Format: "P{para}: {rukuInPara} — {surah} ({verses})\n{deepLink}"
 */
fun shareCaption(ruku: Ruku, base: String = PAGES_BASE): String =
    "P${ruku.para}: ${ruku.rukuInPara} — ${ruku.surah} (${ruku.verses})\n" +
        playerDeepLink(ruku, base)
