package com.mohsingdp.marifatulquran.ui

import com.mohsingdp.marifatulquran.core.ParaGroup
import com.mohsingdp.marifatulquran.core.Ruku
import com.mohsingdp.marifatulquran.data.RukuRepository
import org.junit.Assert.assertEquals
import org.junit.Test

class BrowseViewModelTest {
    private val fake = object : RukuRepository {
        override fun paras() = listOf(
            ParaGroup(1, listOf(Ruku(1, "R1", "Al-Fatihah", 1, "الفاتحة", "1–7", "audio/1/1__R1__Al-Fatihah.opus"))),
            ParaGroup(2, listOf(Ruku(2, "R1", "Al-Baqarah", 2, "البقرة", "142–147", "audio/2/2__R1__Al-Baqarah.ogg"))),
        )
    }

    @Test fun exposesParasFromRepo() {
        assertEquals(listOf(1, 2), BrowseViewModel(fake).paras.map { it.para })
    }

    @Test fun rukusForReturnsThatParasRukus() {
        assertEquals(1, BrowseViewModel(fake).rukusFor(2).size)
        assertEquals("Al-Baqarah", BrowseViewModel(fake).rukusFor(2).first().surah)
    }
}
