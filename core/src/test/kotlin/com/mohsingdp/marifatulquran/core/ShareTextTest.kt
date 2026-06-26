package com.mohsingdp.marifatulquran.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ShareTextTest {

    private val r1 = Ruku(1, "R1", "Al-Fatihah", 1, "الفاتحة", "1–7", "audio/1/1__R1__Al-Fatihah.opus")
    private val r16plus = Ruku(2, "R16+", "Al-Baqarah", 2, "البقرة", "142–147", "audio/2/2__R16+__Al-Baqarah.ogg")

    @Test fun deepLinkForR1EndsWithExpectedQuery() {
        val link = playerDeepLink(r1)
        assertTrue(
            "Link should end with player.html?para=1&ruku=R1 but was: $link",
            link.endsWith("player.html?para=1&ruku=R1")
        )
    }

    @Test fun deepLinkBaseIsPages() {
        val link = playerDeepLink(r1)
        assertTrue(link.startsWith("https://mohsingdp-ai.github.io/Marifatul-Quran/"))
    }

    @Test fun deepLinkPlusInRukuIsPercentEncoded() {
        // URLEncoder.encode("R16+", "UTF-8") = "R16%2B" (form encoding encodes + to %2B)
        val link = playerDeepLink(r16plus)
        assertTrue(
            "Expected ruku=R16%2B but got: $link",
            link.contains("ruku=R16%2B")
        )
    }

    @Test fun deepLinkWithCustomBase() {
        val link = playerDeepLink(r1, "https://example.test/")
        assertEquals("https://example.test/player.html?para=1&ruku=R1", link)
    }

    @Test fun captionFirstLineExact() {
        val caption = shareCaption(r1)
        val firstLine = caption.lines().first()
        assertEquals("P1: R1 — Al-Fatihah (1–7)", firstLine)
    }

    @Test fun captionSecondLineIsDeepLink() {
        val caption = shareCaption(r1)
        val lines = caption.lines()
        assertEquals(2, lines.size)
        assertEquals(playerDeepLink(r1), lines[1])
    }
}
