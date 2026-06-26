package com.mohsingdp.marifatulquran.core

sealed interface DownloadStatus {
    data object NotDownloaded : DownloadStatus
    data object Downloading : DownloadStatus
    data object Downloaded : DownloadStatus
    data class Failed(val reason: String) : DownloadStatus
}

fun isPlayableOffline(s: DownloadStatus): Boolean = s is DownloadStatus.Downloaded
