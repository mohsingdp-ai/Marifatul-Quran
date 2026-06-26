import fs from 'fs';
// data.js lives at the worktree root (sparse-checked-out).
const src = fs.readFileSync('data.js', 'utf8');
const arr = eval(src + '\nQURAN_DATA');
const k = s => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$') + '"';
const lines = arr.map(r =>
  `    Ruku(${r.para}, ${k(r.rukuInPara)}, ${k(r.surah)}, ${r.surahNumber}, ${k(r.surahArabic)}, ${k(r.verses)}, ${k(r.audioUrl)}),`
).join('\n');
const out = `package com.mohsingdp.marifatulquran.core

// GENERATED from data.js by tools/generate-ruku-data.mjs — do not edit by hand.
val ALL_RUKUS: List<Ruku> = listOf(
${lines}
)
`;
fs.writeFileSync('core/src/main/kotlin/com/mohsingdp/marifatulquran/core/RukuData.kt', out);
console.log('Wrote', arr.length, 'rukus');
