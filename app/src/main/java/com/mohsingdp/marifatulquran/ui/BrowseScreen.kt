package com.mohsingdp.marifatulquran.ui

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.snapshots.SnapshotStateMap
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.mohsingdp.marifatulquran.R
import com.mohsingdp.marifatulquran.core.DownloadStatus
import com.mohsingdp.marifatulquran.core.Ruku
import com.mohsingdp.marifatulquran.core.shareCaption
import com.mohsingdp.marifatulquran.data.SavedPosition
import com.mohsingdp.marifatulquran.download.Downloader
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/** Launch a WhatsApp share intent; fallback to system chooser if WhatsApp not installed. */
internal fun shareRukuIntent(context: Context, ruku: Ruku) {
    val text = shareCaption(ruku)
    val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
    try {
        context.startActivity(send.setPackage("com.whatsapp"))
    } catch (e: ActivityNotFoundException) {
        context.startActivity(
            Intent.createChooser(
                Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text),
                "Share",
            )
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BrowseScreen(
    vm: BrowseViewModel,
    resume: SavedPosition? = null,
    onResume: () -> Unit = {},
    onOpen: (para: Int, index: Int) -> Unit,
    onOpenSettings: () -> Unit = {},
    downloader: Downloader,
    downloadStatusMap: SnapshotStateMap<Ruku, DownloadStatus>,
    scope: CoroutineScope,
) {
    val context = LocalContext.current

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Marifatul Quran", style = MaterialTheme.typography.titleLarge) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    actionIconContentColor = MaterialTheme.colorScheme.onPrimary,
                ),
                actions = {
                    IconButton(onClick = onOpenSettings) {
                        Icon(
                            painter = painterResource(id = R.drawable.ic_settings),
                            contentDescription = "Settings",
                            modifier = Modifier.size(24.dp),
                        )
                    }
                },
            )
        },
    ) { innerPadding ->
        LazyColumn(contentPadding = innerPadding) {
            // Resume banner — shown at top if there is a saved position
            if (resume != null) {
                item {
                    val surahName = vm.rukusFor(resume.para).getOrNull(resume.rukuIndex)?.surah
                    val label = if (surahName != null) {
                        "Resume: $surahName — Para ${resume.para}"
                    } else {
                        "Resume: Para ${resume.para}"
                    }
                    Button(
                        onClick = onResume,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                    ) {
                        Text(label)
                    }
                    HorizontalDivider()
                }
            }

            vm.paras.forEach { paraGroup ->
                item {
                    // Para header with "Download all" action
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            text = "Para ${paraGroup.para}",
                            style = MaterialTheme.typography.titleMedium,
                            color = MaterialTheme.colorScheme.primary,
                        )
                        // Show "Download all" only if at least one ruku is not yet downloaded
                        val anyNotDownloaded = paraGroup.rukus.any { r ->
                            downloadStatusMap[r] != DownloadStatus.Downloaded
                        }
                        if (anyNotDownloaded) {
                            TextButton(
                                onClick = {
                                    paraGroup.rukus.forEach { ruku ->
                                        val current = downloadStatusMap[ruku]
                                        if (current != DownloadStatus.Downloaded &&
                                            current != DownloadStatus.Downloading
                                        ) {
                                            downloadStatusMap[ruku] = DownloadStatus.Downloading
                                            scope.launch {
                                                val result = downloader.download(ruku)
                                                downloadStatusMap[ruku] = result
                                            }
                                        }
                                    }
                                },
                            ) {
                                Text("Download all")
                            }
                        }
                    }
                }
                itemsIndexed(paraGroup.rukus) { indexInPara, ruku ->
                    RukuRow(
                        ruku = ruku,
                        downloadStatus = downloadStatusMap[ruku] ?: DownloadStatus.NotDownloaded,
                        onClick = { onOpen(paraGroup.para, indexInPara) },
                        onDownload = {
                            if (downloadStatusMap[ruku] != DownloadStatus.Downloaded &&
                                downloadStatusMap[ruku] != DownloadStatus.Downloading
                            ) {
                                downloadStatusMap[ruku] = DownloadStatus.Downloading
                                scope.launch {
                                    val result = downloader.download(ruku)
                                    downloadStatusMap[ruku] = result
                                }
                            }
                        },
                        onShare = { shareRukuIntent(context, ruku) },
                    )
                    HorizontalDivider()
                }
            }
        }
    }
}

@Composable
private fun RukuRow(
    ruku: Ruku,
    downloadStatus: DownloadStatus,
    onClick: () -> Unit,
    onDownload: () -> Unit,
    onShare: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // Tappable text column (opens player)
        Column(
            modifier = Modifier
                .weight(1f)
                .clickable(onClick = onClick)
                .padding(horizontal = 16.dp, vertical = 10.dp),
        ) {
            Text(
                text = "${ruku.surah} — ${ruku.surahArabic}",
                style = MaterialTheme.typography.bodyLarge,
            )
            Text(
                text = "Para ${ruku.para} · ${ruku.rukuInPara} · ${ruku.verses}",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f),
            )
        }

        // Share button
        IconButton(
            onClick = onShare,
            modifier = Modifier.size(48.dp),
        ) {
            Icon(
                painter = painterResource(id = R.drawable.ic_share),
                contentDescription = "Share",
                tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                modifier = Modifier.size(24.dp),
            )
        }

        // Download affordance
        Box(
            modifier = Modifier
                .size(48.dp)
                .padding(8.dp),
            contentAlignment = Alignment.Center,
        ) {
            when (downloadStatus) {
                DownloadStatus.Downloading -> CircularProgressIndicator(
                    modifier = Modifier.size(24.dp),
                    strokeWidth = 2.dp,
                )
                DownloadStatus.Downloaded -> Icon(
                    painter = painterResource(id = R.drawable.ic_downloaded),
                    contentDescription = "Downloaded",
                    tint = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.size(24.dp),
                )
                else -> IconButton(
                    onClick = onDownload,
                    modifier = Modifier.size(48.dp),
                ) {
                    Icon(
                        painter = painterResource(id = R.drawable.ic_download),
                        contentDescription = "Download",
                        tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f),
                        modifier = Modifier.size(24.dp),
                    )
                }
            }
        }
    }
}
