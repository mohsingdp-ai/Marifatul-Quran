package com.mohsingdp.marifatulquran.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class PlaylistTest {
    private val items = groupByPara().first { it.para == 1 }.rukus  // 16 rukus

    @Test fun startsAtGivenIndex() {
        val pl = Playlist(items, startIndex = 2)
        assertEquals(items[2], pl.current)
        assertEquals(2, pl.index)
    }

    @Test fun nextAdvancesAndReturnsNewCurrent() {
        val pl = Playlist(items, 0)
        assertEquals(items[1], pl.next())
        assertEquals(1, pl.index)
    }

    @Test fun nextAtEndReturnsNullAndDoesNotAdvance() {
        val pl = Playlist(items, items.lastIndex)
        assertFalse(pl.hasNext())
        assertNull(pl.next())
        assertEquals(items.lastIndex, pl.index)
    }

    @Test fun previousAtStartReturnsNull() {
        val pl = Playlist(items, 0)
        assertFalse(pl.hasPrevious())
        assertNull(pl.previous())
    }

    @Test fun seekToChangesCurrent() {
        val pl = Playlist(items, 0)
        assertEquals(items[5], pl.seekTo(5))
        assertTrue(pl.hasPrevious())
    }
}
