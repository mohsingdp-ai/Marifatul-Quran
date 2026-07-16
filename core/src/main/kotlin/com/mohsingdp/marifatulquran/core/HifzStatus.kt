package com.mohsingdp.marifatulquran.core

/**
 * Hifz (memorization) progress model, ported from the web PWA's 4-state design.
 *
 * A ruku is Not started (absent from the map), [HifzState.LEARNING], or [HifzState.MEMORIZED].
 * A memorized ruku can additionally carry a needs-revision flag. Storage/export key is the stable
 * "<para>_<rukuInPara>" (e.g. "1_R7"), never a positional index.
 */
enum class HifzState { LEARNING, MEMORIZED }

data class HifzEntry(val state: HifzState, val revise: Boolean, val atMillis: Long)

data class HifzProgress(val memorized: Int, val learning: Int, val revise: Int, val total: Int)

/** Stable per-ruku key, e.g. "1_R7". */
fun hifzKey(para: Int, rukuInPara: String): String = "${para}_$rukuInPara"

fun hifzKey(ruku: Ruku): String = hifzKey(ruku.para, ruku.rukuInPara)

/** Split a key like "1_R7" back into (para, rukuInPara); null if malformed. */
fun rukuFromHifzKey(key: String): Pair<Int, String>? {
    val us = key.indexOf('_')
    if (us <= 0 || us == key.length - 1) return null
    val para = key.substring(0, us).toIntOrNull() ?: return null
    return para to key.substring(us + 1)
}

/** Tap cycle: not started (null) -> LEARNING -> MEMORIZED -> not started (null). */
fun cycleHifz(current: HifzState?): HifzState? = when (current) {
    null -> HifzState.LEARNING
    HifzState.LEARNING -> HifzState.MEMORIZED
    HifzState.MEMORIZED -> null
}

/** Toggle needs-revision; only meaningful on a memorized entry (others returned unchanged). */
fun toggleRevise(entry: HifzEntry): HifzEntry =
    if (entry.state == HifzState.MEMORIZED) entry.copy(revise = !entry.revise) else entry

fun computeParaProgress(
    map: Map<String, HifzEntry>,
    para: Int,
    rukusInPara: List<String>,
): HifzProgress {
    var memorized = 0
    var learning = 0
    var revise = 0
    for (r in rukusInPara) {
        val e = map[hifzKey(para, r)] ?: continue
        when (e.state) {
            HifzState.MEMORIZED -> {
                memorized++
                if (e.revise) revise++
            }
            HifzState.LEARNING -> learning++
        }
    }
    return HifzProgress(memorized, learning, revise, rukusInPara.size)
}

fun computeOverallMemorized(map: Map<String, HifzEntry>): Int =
    map.values.count { it.state == HifzState.MEMORIZED }

/** Compact single-entry encoding for SharedPreferences: "M,1,<millis>" / "L,0,<millis>". */
fun encodeHifzEntry(e: HifzEntry): String {
    val s = if (e.state == HifzState.MEMORIZED) "M" else "L"
    return "$s,${if (e.revise) 1 else 0},${e.atMillis}"
}

fun decodeHifzEntry(s: String): HifzEntry? {
    val parts = s.split(',')
    if (parts.size < 3) return null
    val state = when (parts[0].trim().uppercase()) {
        "M" -> HifzState.MEMORIZED
        "L" -> HifzState.LEARNING
        else -> return null
    }
    val revise = parts[1].trim() == "1"
    val at = parts[2].trim().toLongOrNull() ?: return null
    return HifzEntry(state, revise, at)
}

private const val HIFZ_HEADER =
    "# Marifatul Quran hifz progress — keep this file to restore after reinstall"

/** Serialize the map to a portable config-file body (one "key=M,1,millis" line per entry). */
fun serializeHifz(map: Map<String, HifzEntry>): String {
    val lines = map.toSortedMap().map { (k, e) -> "$k=${encodeHifzEntry(e)}" }
    return (listOf(HIFZ_HEADER) + lines).joinToString("\n")
}

/** Parse a config-file body back to entries. Tolerant: skips blanks, '#' comments, and bad lines. */
fun parseHifz(text: String): Map<String, HifzEntry> {
    val out = LinkedHashMap<String, HifzEntry>()
    for (raw in text.lineSequence()) {
        val line = raw.trim()
        if (line.isEmpty() || line.startsWith("#")) continue
        val eq = line.indexOf('=')
        if (eq <= 0) continue
        val key = line.substring(0, eq).trim()
        val entry = decodeHifzEntry(line.substring(eq + 1).trim()) ?: continue
        if (key.isNotEmpty()) out[key] = entry
    }
    return out
}
