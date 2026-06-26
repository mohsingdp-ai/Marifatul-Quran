package com.mohsingdp.marifatulquran.core

import org.junit.Assert.assertEquals
import org.junit.Test

class AudioUrlsTest {
    private fun ruku(url: String) = Ruku(3, "R9", "Ali 'Imran", 3, "آل عمران", "1–9", url)

    @Test fun plainFilenameIsAppended() {
        val r = Ruku(1, "R1", "Al-Fatihah", 1, "الفاتحة", "1–7", "audio/1/1__R1__Al-Fatihah.opus")
        assertEquals(
            "https://mohsingdp-ai.github.io/Marifatul-Quran/audio/1/1__R1__Al-Fatihah.opus",
            audioUrl(r)
        )
    }

    @Test fun spaceBecomesPercent20AndApostrophePercent27() {
        val r = ruku("audio/3/3__R9__Ali 'Imran.ogg")
        assertEquals(
            "https://mohsingdp-ai.github.io/Marifatul-Quran/audio/3/3__R9__Ali%20%27Imran.ogg",
            audioUrl(r)
        )
    }

    @Test fun slashesBetweenSegmentsAreNotEncoded() {
        val r = ruku("audio/6/6__R5__Al-Ma'idah.opus")
        assertEquals(
            "https://mohsingdp-ai.github.io/Marifatul-Quran/audio/6/6__R5__Al-Ma%27idah.opus",
            audioUrl(r)
        )
    }

    @Test fun trailingSlashOnBaseIsNotDoubled() {
        val r = Ruku(1, "R1", "X", 1, "x", "1", "audio/1/a.opus")
        assertEquals("https://x.test/audio/1/a.opus", audioUrl(r, "https://x.test/"))
        assertEquals("https://x.test/audio/1/a.opus", audioUrl(r, "https://x.test"))
    }
}
