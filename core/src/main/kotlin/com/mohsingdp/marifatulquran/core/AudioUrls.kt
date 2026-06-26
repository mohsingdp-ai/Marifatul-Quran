package com.mohsingdp.marifatulquran.core

import java.net.URLEncoder

const val PAGES_BASE = "https://mohsingdp-ai.github.io/Marifatul-Quran/"

/** Encode a single path segment for a URL: space -> %20, apostrophe -> %27, '/' preserved by caller. */
private fun encodeSegment(segment: String): String =
    URLEncoder.encode(segment, "UTF-8").replace("+", "%20")

fun audioUrl(ruku: Ruku, base: String = PAGES_BASE): String {
    val encodedRelative = ruku.audioUrl.split("/").joinToString("/") { encodeSegment(it) }
    return base.trimEnd('/') + "/" + encodedRelative
}
