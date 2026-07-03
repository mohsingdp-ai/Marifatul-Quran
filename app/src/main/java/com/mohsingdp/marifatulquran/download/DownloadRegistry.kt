package com.mohsingdp.marifatulquran.download

import com.mohsingdp.marifatulquran.core.DownloadStatus
import com.mohsingdp.marifatulquran.core.Ruku
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update

/**
 * Process-wide source of truth for per-ruku download status. It lives outside any Activity or
 * composition, so status survives configuration changes and Activity teardown, and the background
 * [DownloadForegroundService] and the UI observe the exact same state.
 */
object DownloadRegistry {
    private val _statuses = MutableStateFlow<Map<Ruku, DownloadStatus>>(emptyMap())
    val statuses: StateFlow<Map<Ruku, DownloadStatus>> = _statuses

    private var seeded = false

    /** Populate initial statuses from disk exactly once per process; never overwrites live state. */
    @Synchronized
    fun seedFromDiskOnce(all: List<Ruku>, downloader: Downloader) {
        if (seeded) return
        seeded = true
        _statuses.value = all.associateWith { downloader.status(it) }
    }

    fun set(ruku: Ruku, status: DownloadStatus) {
        _statuses.update { it + (ruku to status) }
    }

    fun statusOf(ruku: Ruku): DownloadStatus =
        _statuses.value[ruku] ?: DownloadStatus.NotDownloaded

    /**
     * Flip any lingering Downloading entries back to NotDownloaded — called when the download
     * service tears down so a stranded item shows a tappable download button (which resumes from
     * its .part) instead of a spinner that never clears. No-op after a normal drain.
     */
    fun markInterrupted() {
        _statuses.update { current ->
            current.mapValues { (_, s) ->
                if (s == DownloadStatus.Downloading) DownloadStatus.NotDownloaded else s
            }
        }
    }
}
