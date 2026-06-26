package com.mohsingdp.marifatulquran.data

import com.mohsingdp.marifatulquran.core.ParaGroup
import com.mohsingdp.marifatulquran.core.groupByPara

interface RukuRepository { fun paras(): List<ParaGroup> }

class DefaultRukuRepository : RukuRepository {
    override fun paras(): List<ParaGroup> = groupByPara()
}
