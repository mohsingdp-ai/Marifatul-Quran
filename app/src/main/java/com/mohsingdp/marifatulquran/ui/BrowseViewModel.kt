package com.mohsingdp.marifatulquran.ui

import com.mohsingdp.marifatulquran.core.ParaGroup
import com.mohsingdp.marifatulquran.core.Ruku
import com.mohsingdp.marifatulquran.data.RukuRepository

class BrowseViewModel(repo: RukuRepository) {
    val paras: List<ParaGroup> = repo.paras()
    fun rukusFor(para: Int): List<Ruku> = paras.firstOrNull { it.para == para }?.rukus ?: emptyList()
}
