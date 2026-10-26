/**
 * Where the Quran uses each صیغہ of the verbs sarf.js lists, so the صرف sheet can say which
 * forms are really read (×12) and list the ayat for the tapped one.
 *
 * Counted from asset/morphology by root + verb form, as sarf.js keys its verbs. A verb is filed
 * by tense, person and voice ("IMPF|2MP|", "PERF|3MP|PASS"), the derived nouns by role alone.
 *
 * Run:  node scripts/build-sarf-counts.js
 * Out:  asset/sarf-counts.json
 */
const fs = require("fs");
const path = require("path");
const { verbs, verbKey, pickVerb, pgnOf } = require("../sarf.js").MQ_SARF;

const ROOT = path.join(__dirname, "..");
const out = {};

for (let p = 1; p <= 30; p++) {
  const morph = JSON.parse(fs.readFileSync(path.join(ROOT, "asset", "morphology", "para-" + p + ".json"), "utf8"));
  for (const ref in morph) {
    morph[ref].forEach((segs, w) => {
      segs.forEach((seg, i) => {
        const key = seg[2] === "V" ? pickVerb(segs, i) : verbKey(seg);
        if (!verbs[key] || seg[1] !== 0) return;
        const flags = String(seg[6] || "").split(",");
        const slot = seg[2] === "V"
          ? seg[3] + "|" + pgnOf(seg) + "|" + (flags.includes("PASS") ? "PASS" : "")
          : /^(ACT_PCPL|PASS_PCPL|VN)$/.test(seg[3]) ? seg[3] : "";
        if (!slot) return;
        const byVerb = out[key] || (out[key] = {});
        (byVerb[slot] || (byVerb[slot] = [])).push([ref + ":" + (w + 1), segs.map((s) => s[0]).join("")]);
      });
    });
  }
}

fs.writeFileSync(path.join(ROOT, "asset", "sarf-counts.json"), JSON.stringify(out));
console.log(Object.keys(out).length + " verbs");
