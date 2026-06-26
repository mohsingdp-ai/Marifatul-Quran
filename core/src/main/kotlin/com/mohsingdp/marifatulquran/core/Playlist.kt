package com.mohsingdp.marifatulquran.core

class Playlist(val items: List<Ruku>, startIndex: Int = 0) {
    init { require(items.isNotEmpty()) { "Playlist must not be empty" } }
    var index: Int = startIndex.coerceIn(0, items.lastIndex)
        private set
    val current: Ruku get() = items[index]
    fun hasNext(): Boolean = index < items.lastIndex
    fun hasPrevious(): Boolean = index > 0
    fun next(): Ruku? { if (!hasNext()) return null; index++; return current }
    fun previous(): Ruku? { if (!hasPrevious()) return null; index--; return current }
    fun seekTo(i: Int): Ruku { index = i.coerceIn(0, items.lastIndex); return current }
}
