package com.mohsingdp.marifatulquran.data

import android.content.Context
import com.mohsingdp.marifatulquran.core.PLAYBACK_MODE_KEY
import com.mohsingdp.marifatulquran.core.PlaybackMode
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
}
