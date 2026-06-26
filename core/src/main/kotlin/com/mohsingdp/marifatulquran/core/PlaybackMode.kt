package com.mohsingdp.marifatulquran.core

enum class PlaybackMode { NONE, LOOP, NEXT }

const val PLAYBACK_MODE_KEY = "playback_mode"

fun PlaybackMode.storageValue(): String = when (this) {
    PlaybackMode.NONE -> "none"
    PlaybackMode.LOOP -> "loop"
    PlaybackMode.NEXT -> "next"
}

fun parsePlaybackMode(s: String?): PlaybackMode = when (s) {
    "loop" -> PlaybackMode.LOOP
    "next" -> PlaybackMode.NEXT
    else -> PlaybackMode.NONE
}
