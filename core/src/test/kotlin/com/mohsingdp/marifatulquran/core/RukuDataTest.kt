package com.mohsingdp.marifatulquran.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RukuDataTest {
    @Test fun hasAll553Rukus() = assertEquals(553, ALL_RUKUS.size)

    @Test fun firstRukuIsAlFatihah() {
        val first = ALL_RUKUS.first()
        assertEquals(1, first.para)
        assertEquals("R1", first.rukuInPara)
        assertEquals("Al-Fatihah", first.surah)
        assertEquals("audio/1/1__R1__Al-Fatihah.opus", first.audioUrl)
    }

    @Test fun coversAll30Paras() {
        assertEquals((1..30).toSet(), ALL_RUKUS.map { it.para }.toSet())
    }

    @Test fun retainsApostropheNames() {
        assertTrue(ALL_RUKUS.any { it.audioUrl.contains("Ali 'Imran") })
    }
}
