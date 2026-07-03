package com.mohsingdp.marifatulquran.core

/** HTTP Range header value to resume from [existingBytes], or null to fetch from the start. */
fun rangeHeaderFor(existingBytes: Long): String? =
    if (existingBytes > 0) "bytes=$existingBytes-" else null

/**
 * Whether the already-downloaded [existingBytes] should be appended to. True only when there is
 * a partial and the server honored the range request with 206 Partial Content; a 200 response
 * means the server sent the whole body, so the partial must be discarded and restarted.
 */
fun shouldResume(existingBytes: Long, httpStatus: Int): Boolean =
    existingBytes > 0 && httpStatus == 206
