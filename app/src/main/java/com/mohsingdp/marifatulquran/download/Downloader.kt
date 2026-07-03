package com.mohsingdp.marifatulquran.download

import com.mohsingdp.marifatulquran.core.DownloadStatus
import com.mohsingdp.marifatulquran.core.Ruku
import com.mohsingdp.marifatulquran.core.audioUrl
import com.mohsingdp.marifatulquran.core.rangeHeaderFor
import com.mohsingdp.marifatulquran.core.retryWithBackoff
import com.mohsingdp.marifatulquran.core.shouldResume
import android.content.Context
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

/**
 * Deterministic, filesystem-safe local filename for a ruku audio file.
 * Format: "${para}_${rukuInPara}.${ext}" where ext is parsed from the audioUrl.
 * Example: para=3, rukuInPara="R9", audioUrl="audio/3/3__R9__Ali 'Imran.ogg" → "3_R9.ogg"
 */
fun localFileName(ruku: Ruku): String {
    val ext = ruku.audioUrl.substringAfterLast('.')
    return "${ruku.para}_${ruku.rukuInPara}.$ext"
}

class Downloader(private val context: Context) {

    /** The local File where this ruku's audio is (or would be) stored. */
    fun localFile(ruku: Ruku): File =
        File(context.filesDir, "audio/" + localFileName(ruku))

    /** Sibling of [localFile] holding in-progress bytes; never the final path (see [download]). */
    private fun partFile(ruku: Ruku): File =
        File(context.filesDir, "audio/" + localFileName(ruku) + ".part")

    /**
     * Returns Downloaded if the local file exists and is non-empty; NotDownloaded otherwise.
     * Does not check file integrity beyond size > 0.
     */
    fun status(ruku: Ruku): DownloadStatus {
        val f = localFile(ruku)
        return if (f.exists() && f.length() > 0) DownloadStatus.Downloaded
        else DownloadStatus.NotDownloaded
    }

    /**
     * Downloads the ruku audio, retrying transient failures with backoff and resuming a partial
     * download via HTTP Range. Bytes accumulate in a sibling ".part" file and are atomically
     * renamed into place only once the full body is present — so the player (which treats any
     * existing localFile as complete) never sees a partial or empty file. On failure the ".part"
     * is deliberately kept so a later attempt can resume instead of restarting from zero.
     */
    suspend fun download(ruku: Ruku): DownloadStatus = withContext(Dispatchers.IO) {
        val dest = localFile(ruku)
        if (dest.exists() && dest.length() > 0) return@withContext DownloadStatus.Downloaded
        dest.parentFile?.mkdirs()
        val part = partFile(ruku)
        val url = audioUrl(ruku)
        try {
            retryWithBackoff(maxAttempts = 4) { fetchInto(url, part) }
            if (!part.renameTo(dest)) {
                // Keep the completed .part (never leave a partial at the final path) and fail so a
                // later attempt can finalize it. A same-filesystem rename effectively never fails.
                throw IOException("could not finalize ${dest.name}")
            }
            DownloadStatus.Downloaded
        } catch (e: CancellationException) {
            throw e // never swallow cancellation; the .part stays for a later resume
        } catch (e: Exception) {
            DownloadStatus.Failed(e.message ?: "download failed")
        }
    }

    /**
     * One fetch attempt. Resumes from [part]'s current length with a Range request: appends on a
     * 206, restarts on a 200 (server ignored the range), discards a stale partial on 416. Verifies
     * the resulting length against the server's declared size and throws on a shortfall so the
     * retry loop resumes rather than renaming a truncated file into place.
     */
    private fun fetchInto(url: String, part: File) {
        val existing = if (part.exists()) part.length() else 0L
        val connection = URL(url).openConnection() as HttpURLConnection
        connection.connectTimeout = 15_000
        connection.readTimeout = 60_000
        // Force identity encoding so Content-Length is the true byte count (no gzip surprises): the
        // length check below is the only guard before a completed file is renamed into the playable path.
        connection.setRequestProperty("Accept-Encoding", "identity")
        rangeHeaderFor(existing)?.let { connection.setRequestProperty("Range", it) }
        try {
            val code = connection.responseCode
            if (code == 416) {
                part.delete() // requested range unsatisfiable: partial is stale, start over
                throw IOException("HTTP 416 (stale partial) for $url")
            }
            if (code != HttpURLConnection.HTTP_OK && code != HttpURLConnection.HTTP_PARTIAL) {
                throw IOException("HTTP $code from $url")
            }
            val append = shouldResume(existing, code)
            if (!append && existing > 0) part.delete() // server sent full body: discard partial
            val bodyLen = connection.contentLengthLong
            FileOutputStream(part, append).use { output ->
                connection.inputStream.use { input -> input.copyTo(output) }
            }
            val expectedTotal = if (append) existing + bodyLen else bodyLen
            if (bodyLen > 0 && part.length() != expectedTotal) {
                throw IOException("incomplete download: ${part.length()} of $expectedTotal bytes")
            }
        } finally {
            connection.disconnect()
        }
    }
}
