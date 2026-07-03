package com.mohsingdp.marifatulquran.core

/**
 * FIFO queue of pending download keys with dedup: a key that is already pending or in-flight
 * is not re-added, so re-tapping "download" (or a whole-para tap that overlaps an in-flight item)
 * never starts the same download twice. A key becomes eligible again after [complete].
 */
class DownloadQueue<T> {
    private val lock = Any()
    private val pending = ArrayDeque<T>()
    private val known = LinkedHashSet<T>() // everything pending OR in-flight

    /** Adds [key] to the back of the queue. Returns false (and ignores it) if already known. */
    fun enqueue(key: T): Boolean = synchronized(lock) {
        if (!known.add(key)) return false
        pending.addLast(key)
        true
    }

    /** Removes and returns the front key, marking it in-flight; null if the queue is empty. */
    fun poll(): T? = synchronized(lock) { pending.removeFirstOrNull() }

    /** Forgets [key] so it may be enqueued again in the future. */
    fun complete(key: T) = synchronized(lock) {
        known.remove(key)
        pending.remove(key)
        Unit
    }

    /** True when nothing is pending or in-flight — i.e. all enqueued work has been completed. */
    fun isIdle(): Boolean = synchronized(lock) { known.isEmpty() }
}
