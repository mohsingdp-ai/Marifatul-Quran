package com.mohsingdp.marifatulquran.core

data class ParaGroup(val para: Int, val rukus: List<Ruku>)

fun groupByPara(rukus: List<Ruku> = ALL_RUKUS): List<ParaGroup> =
    rukus.groupBy { it.para }
        .toSortedMap()
        .map { (para, items) -> ParaGroup(para, items) }
