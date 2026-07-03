package com.mohsingdp.marifatulquran.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ResumePlanTest {

    @Test fun requestsRemainingBytesWhenPartialExists() {
        assertNull(rangeHeaderFor(0))
        assertEquals("bytes=1024-", rangeHeaderFor(1024))
    }

    @Test fun appendsOnlyWhenServerHonorsRangeWith206() {
        assertTrue(shouldResume(existingBytes = 1024, httpStatus = 206))
        assertFalse(shouldResume(existingBytes = 1024, httpStatus = 200))
        assertFalse(shouldResume(existingBytes = 0, httpStatus = 206))
    }

    @Test fun doesNotResumeOnNon206Statuses() {
        // 416 Range Not Satisfiable (stale/invalid partial) and server errors must not append.
        assertFalse(shouldResume(existingBytes = 1024, httpStatus = 416))
        assertFalse(shouldResume(existingBytes = 1024, httpStatus = 500))
    }
}
