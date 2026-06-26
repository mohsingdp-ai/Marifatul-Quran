package com.mohsingdp.marifatulquran.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.mohsingdp.marifatulquran.core.Ruku

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BrowseScreen(
    vm: BrowseViewModel,
    onOpen: (para: Int, index: Int) -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Marifatul Quran", style = MaterialTheme.typography.titleLarge) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                ),
            )
        },
    ) { innerPadding ->
        LazyColumn(contentPadding = innerPadding) {
            vm.paras.forEach { paraGroup ->
                item {
                    Text(
                        text = "Para ${paraGroup.para}",
                        style = MaterialTheme.typography.titleMedium,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                    )
                }
                itemsIndexed(paraGroup.rukus) { indexInPara, ruku ->
                    RukuRow(
                        ruku = ruku,
                        onClick = { onOpen(paraGroup.para, indexInPara) },
                    )
                    HorizontalDivider()
                }
            }
        }
    }
}

@Composable
private fun RukuRow(ruku: Ruku, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
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
}
