package com.mohsingdp.marifatulquran.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class HifzStatusTest {

    @Test fun keyIsStableParaUnderscoreRuku() {
        assertEquals("1_R7", hifzKey(1, "R7"))
        assertEquals("30_R1", hifzKey(30, "R1"))
    }

    @Test fun tapCyclesNotStartedLearningMemorizedBack() {
        assertEquals(HifzState.LEARNING, cycleHifz(null))
        assertEquals(HifzState.MEMORIZED, cycleHifz(HifzState.LEARNING))
        assertNull(cycleHifz(HifzState.MEMORIZED))
    }

    @Test fun toggleReviseOnlyAffectsMemorized() {
        val mem = HifzEntry(HifzState.MEMORIZED, revise = false, atMillis = 100L)
        assertTrue(toggleRevise(mem).revise)
        assertEquals(false, toggleRevise(toggleRevise(mem)).revise)
        // Learning entries are returned unchanged.
        val learn = HifzEntry(HifzState.LEARNING, revise = false, atMillis = 100L)
        assertEquals(learn, toggleRevise(learn))
    }

    @Test fun paraProgressCountsMemorizedLearningReviseAgainstTotal() {
        val map = mapOf(
            "1_R1" to HifzEntry(HifzState.MEMORIZED, false, 1L),
            "1_R2" to HifzEntry(HifzState.MEMORIZED, true, 1L),
            "1_R3" to HifzEntry(HifzState.LEARNING, false, 1L),
            "2_R1" to HifzEntry(HifzState.MEMORIZED, false, 1L), // other para, ignored
        )
        val p = computeParaProgress(map, 1, listOf("R1", "R2", "R3", "R4"))
        assertEquals(HifzProgress(memorized = 2, learning = 1, revise = 1, total = 4), p)
    }

    @Test fun overallCountsOnlyMemorized() {
        val map = mapOf(
            "1_R1" to HifzEntry(HifzState.MEMORIZED, false, 1L),
            "1_R2" to HifzEntry(HifzState.LEARNING, false, 1L),
            "2_R1" to HifzEntry(HifzState.MEMORIZED, true, 1L),
        )
        assertEquals(2, computeOverallMemorized(map))
    }

    @Test fun entryEncodeDecodeRoundTrips() {
        val e = HifzEntry(HifzState.MEMORIZED, revise = true, atMillis = 1783248000000L)
        assertEquals(e, decodeHifzEntry(encodeHifzEntry(e)))
        val l = HifzEntry(HifzState.LEARNING, revise = false, atMillis = 42L)
        assertEquals(l, decodeHifzEntry(encodeHifzEntry(l)))
        assertNull(decodeHifzEntry("garbage"))
        assertNull(decodeHifzEntry("X,0,1"))
    }

    @Test fun configRoundTripsEntries() {
        val map = mapOf(
            "1_R1" to HifzEntry(HifzState.MEMORIZED, true, 1783248000000L),
            "2_R3" to HifzEntry(HifzState.LEARNING, false, 1783250000000L),
        )
        assertEquals(map, parseHifz(serializeHifz(map)))
    }

    @Test fun parseIgnoresCommentsBlanksAndGarbage() {
        val text = """
            # Marifatul Quran hifz progress

            1_R1=M,1,1783248000000
            garbage-no-equals
            2_R3=L,0,1783250000000
            3_R1=M,0,notanumber
            4_R1=X,0,1
        """.trimIndent()
        assertEquals(
            mapOf(
                "1_R1" to HifzEntry(HifzState.MEMORIZED, true, 1783248000000L),
                "2_R3" to HifzEntry(HifzState.LEARNING, false, 1783250000000L),
            ),
            parseHifz(text),
        )
    }
}
