package com.mohsingdp.marifatulquran.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DownloadQueueTest {

    @Test fun ignoresDuplicateWhilePending() {
        val q = DownloadQueue<String>()
        assertTrue(q.enqueue("a"))
        assertFalse(q.enqueue("a"))
        assertEquals("a", q.poll())
        assertNull(q.poll())
    }

    @Test fun ignoresDuplicateWhileInFlightUntilCompleted() {
        val q = DownloadQueue<String>()
        q.enqueue("a")
        assertEquals("a", q.poll()) // now in-flight
        assertFalse(q.enqueue("a")) // still known -> ignored
        q.complete("a")
        assertTrue(q.enqueue("a")) // completed -> allowed again
    }

    @Test fun pollsInFifoOrder() {
        val q = DownloadQueue<String>()
        q.enqueue("a")
        q.enqueue("b")
        q.enqueue("c")
        assertEquals(listOf("a", "b", "c"), listOf(q.poll(), q.poll(), q.poll()))
    }

    @Test fun isIdleOnlyWhenNothingPendingOrInFlight() {
        val q = DownloadQueue<String>()
        assertTrue(q.isIdle())
        q.enqueue("a")
        assertFalse(q.isIdle()) // pending
        q.poll()
        assertFalse(q.isIdle()) // in-flight (polled, not completed)
        q.complete("a")
        assertTrue(q.isIdle()) // done
    }
}
