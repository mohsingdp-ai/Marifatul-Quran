package com.mohsingdp.marifatulquran.data

import org.junit.Assert.assertEquals
import org.junit.Test

class PrefsLogicTest {
    @Test fun keyIsStablePerPara() {
        assertEquals("pos_para_3", positionKey(3))
    }
}
