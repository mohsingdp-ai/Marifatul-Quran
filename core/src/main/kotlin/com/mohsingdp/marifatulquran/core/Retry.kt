package com.mohsingdp.marifatulquran.core

/**
 * Exponential backoff waits (ms) to sleep *before* each retry. For [maxAttempts] total tries
 * there are [maxAttempts] - 1 waits: baseMs, 2*baseMs, 4*baseMs, ... each capped at [maxMs].
 */
fun backoffDelaysMs(maxAttempts: Int, baseMs: Long = 1000L, maxMs: Long = 30_000L): List<Long> {
    val waits = (maxAttempts - 1).coerceAtLeast(0)
    return (0 until waits).map { i -> (baseMs shl i.coerceAtMost(30)).coerceAtMost(maxMs) }
}

/**
 * Runs [op] (1-based attempt number) up to [maxAttempts] times, sleeping the corresponding
 * [delays] entry between tries. Returns the first successful result; if every attempt throws,
 * rethrows the last exception. [sleep] is injectable so tests can control time without waiting.
 */
fun <T> retryWithBackoff(
    maxAttempts: Int,
    delays: List<Long> = backoffDelaysMs(maxAttempts),
    sleep: (Long) -> Unit = { Thread.sleep(it) },
    op: (attempt: Int) -> T,
): T {
    require(maxAttempts >= 1) { "maxAttempts must be >= 1" }
    var lastError: Exception? = null
    for (attempt in 1..maxAttempts) {
        try {
            return op(attempt)
        } catch (c: kotlin.coroutines.cancellation.CancellationException) {
            throw c // never retry through a coroutine cancellation
        } catch (e: Exception) {
            lastError = e
            if (attempt < maxAttempts) delays.getOrNull(attempt - 1)?.let(sleep)
        }
    }
    throw lastError ?: IllegalStateException("retryWithBackoff made no attempts")
}
