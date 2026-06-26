package com.mohsingdp.marifatulquran.core

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DownloadStatusTest {
    @Test fun onlyDownloadedIsPlayableOffline() {
        assertTrue(isPlayableOffline(DownloadStatus.Downloaded))
        assertFalse(isPlayableOffline(DownloadStatus.NotDownloaded))
        assertFalse(isPlayableOffline(DownloadStatus.Downloading))
        assertFalse(isPlayableOffline(DownloadStatus.Failed("io")))
    }
}
