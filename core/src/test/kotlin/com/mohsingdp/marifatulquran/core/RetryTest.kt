package com.mohsingdp.marifatulquran.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

class RetryTest {

    @Test fun succeedsOnThirdAttempt() {
        var attempts = 0
        val result = retryWithBackoff(maxAttempts = 5, delays = listOf(0, 0, 0, 0), sleep = {}) {
            attempts++
            if (attempts < 3) throw RuntimeException("transient")
            "downloaded"
        }
        assertEquals("downloaded", result)
        assertEquals(3, attempts)
    }

    @Test fun givesUpAfterMaxAttemptsAndRethrowsLastError() {
        var attempts = 0
        val ex = assertThrows(IllegalStateException::class.java) {
            retryWithBackoff(maxAttempts = 3, delays = listOf(0, 0), sleep = {}) {
                attempts++
                throw IllegalStateException("boom $attempts")
            }
        }
        assertEquals(3, attempts)
        assertEquals("boom 3", ex.message)
    }

    @Test fun waitsBackoffBetweenAttempts() {
        val slept = mutableListOf<Long>()
        var attempts = 0
        retryWithBackoff(maxAttempts = 4, delays = listOf(100, 200, 400), sleep = { slept.add(it) }) {
            attempts++
            if (attempts < 4) throw RuntimeException("transient")
        }
        assertEquals(listOf(100L, 200L, 400L), slept)
    }

    @Test fun doesNotSleepWhenFirstAttemptSucceeds() {
        val slept = mutableListOf<Long>()
        retryWithBackoff(maxAttempts = 3, delays = listOf(100, 200), sleep = { slept.add(it) }) { "ok" }
        assertTrue(slept.isEmpty())
    }

    @Test fun defaultBackoffGrowsExponentiallyAndCaps() {
        assertEquals(listOf(1000L, 2000L, 4000L), backoffDelaysMs(maxAttempts = 4, baseMs = 1000L, maxMs = 30_000L))
        assertEquals(listOf(1000L, 2000L, 3000L), backoffDelaysMs(maxAttempts = 4, baseMs = 1000L, maxMs = 3000L))
    }

    @Test fun singleAttemptRunsOnceWithNoRetryAndNoSleep() {
        val slept = mutableListOf<Long>()
        var attempts = 0
        val ex = assertThrows(RuntimeException::class.java) {
            retryWithBackoff(maxAttempts = 1, delays = emptyList(), sleep = { slept.add(it) }) {
                attempts++
                throw RuntimeException("once")
            }
        }
        assertEquals(1, attempts)
        assertTrue(slept.isEmpty())
        assertEquals("once", ex.message)
    }

    @Test fun rejectsNonPositiveMaxAttempts() {
        assertThrows(IllegalArgumentException::class.java) {
            retryWithBackoff(maxAttempts = 0, delays = emptyList(), sleep = {}) { "never" }
        }
    }

    @Test fun oneAttemptHasNoWaits() {
        assertEquals(emptyList<Long>(), backoffDelaysMs(maxAttempts = 1))
    }
}
