package com.mohsingdp.marifatulquran.data

import android.content.Context

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
}
