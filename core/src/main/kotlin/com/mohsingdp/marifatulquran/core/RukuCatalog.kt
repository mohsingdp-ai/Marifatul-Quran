package com.mohsingdp.marifatulquran.core

data class ParaGroup(val para: Int, val rukus: List<Ruku>)

fun groupByPara(rukus: List<Ruku> = ALL_RUKUS): List<ParaGroup> =
    rukus.groupBy { it.para }
        .toSortedMap()
        .map { (para, items) -> ParaGroup(para, items) }

/** Look up a ruku by its para and in-para label (e.g. 3, "R9"); null if not found. */
fun rukuFor(para: Int, rukuInPara: String, rukus: List<Ruku> = ALL_RUKUS): Ruku? =
    rukus.firstOrNull { it.para == para && it.rukuInPara == rukuInPara }
