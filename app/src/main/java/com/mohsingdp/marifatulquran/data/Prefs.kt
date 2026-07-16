package com.mohsingdp.marifatulquran.data

import android.content.Context
import com.mohsingdp.marifatulquran.core.HifzEntry
import com.mohsingdp.marifatulquran.core.PLAYBACK_MODE_KEY
import com.mohsingdp.marifatulquran.core.PlaybackMode
import com.mohsingdp.marifatulquran.core.Ruku
import com.mohsingdp.marifatulquran.core.decodeHifzEntry
import com.mohsingdp.marifatulquran.core.encodeHifzEntry
import com.mohsingdp.marifatulquran.core.hifzKey
import com.mohsingdp.marifatulquran.core.parsePlaybackMode
import com.mohsingdp.marifatulquran.core.storageValue

/** Stable SharedPreferences key for the saved position of a given para. */
fun positionKey(para: Int): String = "pos_para_$para"

data class SavedPosition(
    val para: Int,
    val rukuIndex: Int,
    val positionMs: Long,
)

class Prefs(context: Context) {
    private val prefs = context.getSharedPreferences("mq", Context.MODE_PRIVATE)

    fun savePosition(para: Int, rukuIndex: Int, positionMs: Long) {
        prefs.edit()
            .putInt("last_para", para)
            .putInt("last_ruku_index", rukuIndex)
            .putLong("last_position_ms", positionMs)
            .apply()
    }

    fun lastPosition(): SavedPosition? {
        val para = prefs.getInt("last_para", -1)
        if (para == -1) return null
        val rukuIndex = prefs.getInt("last_ruku_index", 0)
        val positionMs = prefs.getLong("last_position_ms", 0L)
        return SavedPosition(para, rukuIndex, positionMs)
    }

    fun getPlaybackMode(): PlaybackMode =
        parsePlaybackMode(prefs.getString(PLAYBACK_MODE_KEY, null))

    fun setPlaybackMode(m: PlaybackMode) {
        prefs.edit().putString(PLAYBACK_MODE_KEY, m.storageValue()).apply()
    }

    /** Default playback speed seeded into each ruku's speed control. Mirrors the web `default_speed`. */
    fun getDefaultSpeed(): Float = prefs.getFloat("default_speed", 1f)

    fun setDefaultSpeed(speed: Float) {
        prefs.edit().putFloat("default_speed", speed).apply()
    }

    /** Whether the first-run guided walkthrough has already been shown. */
    fun isGuideSeen(): Boolean = prefs.getBoolean("guide_seen", false)

    fun setGuideSeen() {
        prefs.edit().putBoolean("guide_seen", true).apply()
    }

    /** Whether the WhatsApp share affordances are shown. Defaults to off. */
    fun isWhatsAppShareEnabled(): Boolean = prefs.getBoolean("whatsapp_share", false)

    fun setWhatsAppShareEnabled(enabled: Boolean) {
        prefs.edit().putBoolean("whatsapp_share", enabled).apply()
    }

    /** Whether the hifz (memorization) tracker is shown. Defaults to on. */
    fun isHifzEnabled(): Boolean = prefs.getBoolean("hifz_enabled", true)

    fun setHifzEnabled(enabled: Boolean) {
        prefs.edit().putBoolean("hifz_enabled", enabled).apply()
    }

    // --- Hifz (memorization) progress. Stored one entry per ruku under "hifz_<para>_<ruku>";
    //     absent key = not started. This prefs file is what Auto Backup restores. ---
    private fun hifzPrefKey(ruku: Ruku) = "hifz_${hifzKey(ruku)}"

    fun getHifz(ruku: Ruku): HifzEntry? =
        prefs.getString(hifzPrefKey(ruku), null)?.let { decodeHifzEntry(it) }

    fun setHifz(ruku: Ruku, entry: HifzEntry?) {
        prefs.edit().apply {
            if (entry == null) remove(hifzPrefKey(ruku)) else putString(hifzPrefKey(ruku), encodeHifzEntry(entry))
        }.apply()
    }

    /** Remove every stored hifz entry (Reset progress). */
    fun clearHifz() {
        prefs.edit().apply {
            prefs.all.keys.filter { it.startsWith("hifz_") }.forEach { remove(it) }
        }.apply()
    }
}
