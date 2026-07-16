package com.mohsingdp.marifatulquran.data

import com.mohsingdp.marifatulquran.core.HifzEntry
import com.mohsingdp.marifatulquran.core.HifzState
import com.mohsingdp.marifatulquran.core.Ruku
import com.mohsingdp.marifatulquran.core.cycleHifz
import com.mohsingdp.marifatulquran.core.hifzKey
import com.mohsingdp.marifatulquran.core.rukuFor
import com.mohsingdp.marifatulquran.core.rukuFromHifzKey
import com.mohsingdp.marifatulquran.core.toggleRevise
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update

/**
 * Process-wide, observable hifz (memorization) state (ruku -> [HifzEntry]). Backed by [Prefs]; that
 * prefs file is what Auto Backup restores and what export/import mirrors, so progress survives an
 * app reinstall. Mirrors the DownloadRegistry pattern.
 */
object HifzRegistry {
    private val _entries = MutableStateFlow<Map<Ruku, HifzEntry>>(emptyMap())
    val entries: StateFlow<Map<Ruku, HifzEntry>> = _entries

    private var seeded = false

    @Synchronized
    fun seedFromPrefsOnce(all: List<Ruku>, prefs: Prefs) {
        if (seeded) return
        seeded = true
        _entries.value = all.mapNotNull { r -> prefs.getHifz(r)?.let { r to it } }.toMap()
    }

    /** Tap: advance the progress state (not started -> learning -> memorized -> not started). */
    fun tap(ruku: Ruku, nowMillis: Long, prefs: Prefs) {
        val current = _entries.value[ruku]
        val nextState = cycleHifz(current?.state)
        val next = if (nextState == null) null else HifzEntry(
            state = nextState,
            revise = current?.revise == true && nextState == HifzState.MEMORIZED,
            atMillis = nowMillis,
        )
        prefs.setHifz(ruku, next)
        _entries.update { if (next == null) it - ruku else it + (ruku to next) }
    }

    /** Long-press: toggle needs-revision on a memorized ruku (no-op otherwise). */
    fun toggleRevision(ruku: Ruku, nowMillis: Long, prefs: Prefs) {
        val current = _entries.value[ruku] ?: return
        if (current.state != HifzState.MEMORIZED) return
        val next = toggleRevise(current).copy(atMillis = nowMillis)
        prefs.setHifz(ruku, next)
        _entries.update { it + (ruku to next) }
    }

    /** Current entries as key -> entry, for the exported config. */
    fun exportMap(): Map<String, HifzEntry> =
        _entries.value.entries.associate { (r, e) -> hifzKey(r) to e }

    /** Merge imported entries (key -> entry) into prefs + state (imported wins). Returns applied count. */
    fun import(entries: Map<String, HifzEntry>, prefs: Prefs): Int {
        val current = _entries.value.toMutableMap()
        var applied = 0
        for ((key, entry) in entries) {
            val pair = rukuFromHifzKey(key) ?: continue
            val ruku = rukuFor(pair.first, pair.second) ?: continue
            prefs.setHifz(ruku, entry)
            current[ruku] = entry
            applied++
        }
        _entries.value = current
        return applied
    }

    fun clear(prefs: Prefs) {
        prefs.clearHifz()
        _entries.value = emptyMap()
    }
}
