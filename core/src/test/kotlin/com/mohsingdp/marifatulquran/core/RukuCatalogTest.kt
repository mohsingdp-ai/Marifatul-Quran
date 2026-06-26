package com.mohsingdp.marifatulquran.core

import org.junit.Assert.assertEquals
import org.junit.Test

class RukuCatalogTest {
    @Test fun groupsInto30ParasInOrder() {
        val groups = groupByPara()
        assertEquals(30, groups.size)
        assertEquals((1..30).toList(), groups.map { it.para })
    }

    @Test fun para1Has16Rukus() {
        assertEquals(16, groupByPara().first { it.para == 1 }.rukus.size)
    }

    @Test fun everyRukuInAGroupBelongsToThatPara() {
        groupByPara().forEach { g -> g.rukus.forEach { assertEquals(g.para, it.para) } }
    }
}
