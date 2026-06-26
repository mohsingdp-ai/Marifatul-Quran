package com.mohsingdp.marifatulquran.download

import com.mohsingdp.marifatulquran.core.Ruku
import org.junit.Assert.assertEquals
import org.junit.Test

class LocalPathTest {
    @Test fun safeNameKeepsExtension() {
        val r = Ruku(3, "R9", "Ali 'Imran", 3, "x", "1", "audio/3/3__R9__Ali 'Imran.ogg")
        assertEquals("3_R9.ogg", localFileName(r)) // para_ruku.ext — no spaces/apostrophes
    }
}
