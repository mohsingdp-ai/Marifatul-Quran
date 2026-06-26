package com.mohsingdp.marifatulquran.core

import org.junit.Assert.assertEquals
import org.junit.Test

class PlaybackModeTest {

    @Test fun parseLoopeReturnsLOOP() {
        assertEquals(PlaybackMode.LOOP, parsePlaybackMode("loop"))
    }

    @Test fun parseNextReturnsNEXT() {
        assertEquals(PlaybackMode.NEXT, parsePlaybackMode("next"))
    }

    @Test fun parseNullReturnsNONE() {
        assertEquals(PlaybackMode.NONE, parsePlaybackMode(null))
    }

    @Test fun parseGarbageReturnsNONE() {
        assertEquals(PlaybackMode.NONE, parsePlaybackMode("garbage"))
    }

    @Test fun parseEmptyReturnsNONE() {
        assertEquals(PlaybackMode.NONE, parsePlaybackMode(""))
    }

    @Test fun roundTripLoop() {
        assertEquals(PlaybackMode.LOOP, parsePlaybackMode(PlaybackMode.LOOP.storageValue()))
    }

    @Test fun roundTripNext() {
        assertEquals(PlaybackMode.NEXT, parsePlaybackMode(PlaybackMode.NEXT.storageValue()))
    }

    @Test fun roundTripNone() {
        assertEquals(PlaybackMode.NONE, parsePlaybackMode(PlaybackMode.NONE.storageValue()))
    }

    @Test fun storageValueNone() {
        assertEquals("none", PlaybackMode.NONE.storageValue())
    }

    @Test fun storageValueLoop() {
        assertEquals("loop", PlaybackMode.LOOP.storageValue())
    }

    @Test fun storageValueNext() {
        assertEquals("next", PlaybackMode.NEXT.storageValue())
    }
}
