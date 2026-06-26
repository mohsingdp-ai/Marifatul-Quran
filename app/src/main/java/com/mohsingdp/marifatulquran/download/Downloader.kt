package com.mohsingdp.marifatulquran.download

import android.content.Context
import com.mohsingdp.marifatulquran.core.DownloadStatus
import com.mohsingdp.marifatulquran.core.Ruku
import com.mohsingdp.marifatulquran.core.audioUrl
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
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
     * Downloads the ruku audio via HttpURLConnection and atomically renames it into place.
     * Uses a sibling temp file so renameTo stays within the same filesystem.
     */
    suspend fun download(ruku: Ruku): DownloadStatus = withContext(Dispatchers.IO) {
        val dest = localFile(ruku)
        dest.parentFile?.mkdirs()

        val url = audioUrl(ruku)
        var tempFile: File? = null
        try {
            tempFile = File.createTempFile("dl_", ".part", dest.parentFile)

            val connection = URL(url).openConnection() as HttpURLConnection
            connection.connectTimeout = 15_000
            connection.readTimeout = 60_000
            try {
                val code = connection.responseCode
                if (code != HttpURLConnection.HTTP_OK) {
                    return@withContext DownloadStatus.Failed("HTTP $code from $url")
                }
                connection.inputStream.use { input ->
                    tempFile.outputStream().use { output ->
                        input.copyTo(output)
                    }
                }
            } finally {
                connection.disconnect()
            }

            val renamed = tempFile.renameTo(dest)
            if (!renamed) {
                tempFile.delete()
                return@withContext DownloadStatus.Failed("rename failed for ${dest.name}")
            }
            DownloadStatus.Downloaded
        } catch (e: Exception) {
            tempFile?.delete()
            DownloadStatus.Failed(e.message ?: "unknown error")
        }
    }
}
