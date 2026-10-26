/**
 * صرف for the verbs a reader taps: the صرف صغیر and the 14 صیغے of ماضی and مضارع.
 *
 * Every verb of the paras done so far is listed (MORE says which). Each verb is
 * keyed "root|VF" as the Quranic Arabic Corpus tags it (asset/morphology), so a tapped stem
 * finds its entry from its own tags. The Arabic of every form is built from two or three
 * stems by the rules below; the Urdu is built by rule from one Urdu stem, so it is a draft
 * until checked (the sheet says so).
 *
 * Stems:
 *   past  { t: "s", v, c }  sound, hollow, doubled: v before a vowel ending, c before a consonant
 *         { t: "a", r }     ends in ـَى (رَمَى): r = رَمَ
 *         { t: "aw", r }    ends in ـَا (دَعَا): r = دَعَ
 *         { t: "i", r }     ends in ـِيَ (نَسِيَ, أُوذِيَ): r = أُوذِ
 *   pres  { pv, t: "s", b, c }  pv = the prefix vowel; c (default b) before ـْنَ (يَسْتَجِبْنَ)
 *         { pv, t: "i", r }     ends in ـِي (يَرْمِي): r = رْمِ
 *         { pv, t: "a", r }     ends in ـَى (يَتَوَفَّى): r = تَوَفَّ
 *         { pv, t: "u", r }     ends in ـُو (يَدْعُو): r = دْعُ
 * six: ماضی, مضارع, امر, مصدر, اسم فاعل, اسم مفعول ("" when the verb takes no object).
 * ur: the Urdu stem; erg: the past takes نے (اس نے سنا); f: that past agrees with a feminine
 * object in the stem (ہجرت کی); aux: an intransitive past with a helper (فلاح پا گیا).
 * pass: the مجہول stems, for the verbs read that way in this ruku.
 */
(function (global) {
  "use strict";

  /** The 14 صیغے in the order teachers recite them. */
  var PGN = ["3MS", "3MD", "3MP", "3FS", "3FD", "3FP", "2MS", "2MD", "2MP", "2FS", "2FD", "2FP", "1S", "1P"];

  var PAST_V = { "3MS": "َ", "3MD": "َا", "3MP": "ُوا", "3FS": "َتْ", "3FD": "َتَا" };
  var PAST_C = { "3FP": "نَ", "2MS": "تَ", "2MD": "تُمَا", "2MP": "تُمْ", "2FS": "تِ", "2FD": "تُمَا", "2FP": "تُنَّ", "1S": "تُ", "1P": "نَا" };
  var PRES_PREFIX = { "3FS": "ت", "3FD": "ت", "2MS": "ت", "2MD": "ت", "2MP": "ت", "2FS": "ت", "2FD": "ت", "2FP": "ت", "1S": "أ", "1P": "ن" };
  var PRES_SOUND = { D: "َانِ", MP: "ُونَ", FP: "ْنَ", FS2: "ِينَ", S: "ُ" };

  function dropKasra(r) { return r.replace(/[ِ]$/, ""); }
  function dropDamma(r) { return r.replace(/ُ$/, ""); }

  function pastForm(st, pgn) {
    if (st.t === "s") return PAST_V[pgn] ? st.v + PAST_V[pgn] : st.c + PAST_C[pgn];
    if (st.t === "a" || st.t === "aw") {
      var w = st.t === "aw" ? "و" : "ي";
      // After a ي the ending is written ا, not ى: أَحْيَا.
      var a = { "3MS": w === "و" || /يَ$/.test(st.r) ? "ا" : "ى", "3MD": w + "َا", "3MP": "وْا", "3FS": "تْ", "3FD": "تَا" }[pgn];
      return a ? st.r + a : st.r + w + "ْ" + PAST_C[pgn];
    }
    if (pgn === "3MP") return dropKasra(st.r) + "ُوا";
    var i = { "3MS": "يَ", "3MD": "يَا", "3FS": "يَتْ", "3FD": "يَتَا" }[pgn];
    return i ? st.r + i : st.r + "ي" + PAST_C[pgn];
  }

  /** Which ending a present form takes: dual, masculine plural, feminine plural, 2FS, or plain. */
  function presSlot(pgn) {
    if (/D$/.test(pgn)) return "D";
    if (/MP$/.test(pgn)) return "MP";
    if (/FP$/.test(pgn)) return "FP";
    return pgn === "2FS" ? "FS2" : "S";
  }

  function presForm(st, pgn) {
    var pre = (PRES_PREFIX[pgn] || "ي") + st.pv;
    var slot = presSlot(pgn);
    if (st.t === "s") return pre + (slot === "FP" ? st.c || st.b : st.b) + PRES_SOUND[slot];
    if (st.t === "u") {
      if (slot === "FS2") return pre + dropDamma(st.r) + "ِينَ";
      return pre + st.r + { D: "وَانِ", MP: "ونَ", FP: "ونَ", S: "و" }[slot];
    }
    if (st.t === "i") {
      if (slot === "MP") return pre + dropKasra(st.r) + "ُونَ";
      return pre + st.r + { D: "يَانِ", FP: "ينَ", FS2: "ينَ", S: "ي" }[slot];
    }
    return pre + st.r + { D: "يَانِ", MP: "وْنَ", FP: "يْنَ", FS2: "يْنَ", S: "ى" }[slot];
  }

  /* ---------------- Urdu, by rule ---------------- */

  // (مؤنث), not (عورت): a feminine صیغہ is as often a thing as a woman (طَلَعَتْ, the sun rose).
  var SUBJ = ["وہ", "وہ دونوں", "وہ سب", "وہ (مؤنث)", "وہ دونوں (مؤنث)", "وہ سب (مؤنث)",
    "تُو", "تم دونوں", "تم سب", "تُو (مؤنث)", "تم دونوں (مؤنث)", "تم سب (مؤنث)", "میں", "ہم"];
  var ERG = ["اس نے", "ان دونوں نے", "انہوں نے", "اس (مؤنث) نے", "ان دونوں (مؤنث) نے", "ان (مؤنث) نے",
    "تُو نے", "تم دونوں نے", "تم نے", "تُو (مؤنث) نے", "تم دونوں (مؤنث) نے", "تم (مؤنث) نے", "میں نے", "ہم نے"];
  /** Agreement: m / f singular, M / F plural. */
  var AGR = "mMMfFFmMMfFFmM";
  var AUX = ["ہے", "ہیں", "ہیں", "ہے", "ہیں", "ہیں", "ہے", "ہو", "ہو", "ہے", "ہو", "ہو", "ہوں", "ہیں"];
  var ORDER = { m: 0, M: 1, f: 2, F: 3 };
  var PERF_IRREGULAR = {
    "کر": ["کیا", "کیے", "کی", "کیں"], "جا": ["گیا", "گئے", "گئی", "گئیں"], "ہو": ["ہوا", "ہوئے", "ہوئی", "ہوئیں"],
    "دے": ["دیا", "دیے", "دی", "دیں"], "لے": ["لیا", "لیے", "لی", "لیں"]
  };

  /** "فلاح پا" -> ["فلاح ", "پا"]: only the last word bends. */
  function split(ur) {
    var i = ur.lastIndexOf(" ");
    return [ur.slice(0, i + 1), ur.slice(i + 1)];
  }

  function perf(word, agr) {
    var irr = PERF_IRREGULAR[word];
    if (irr) return irr[ORDER[agr]];
    var ends = /[اوآ]$/.test(word) ? ["یا", "ئے", "ئی", "ئیں"] : ["ا", "ے", "ی", "یں"];
    return word + ends[ORDER[agr]];
  }

  function impf(word, agr) {
    return word.replace(/ے$/, "ی") + { m: "تا", M: "تے", f: "تی", F: "تی" }[agr];
  }

  function urdu(verb, tense, passive, i) {
    var s = split(verb.ur);
    var agr = AGR[i];
    if (passive) {
      // Only the helper takes the plural ں: ستائی گئیں, not ستائیں گئیں.
      var p = split(verb.pu || verb.ur);
      // A feminine noun in the stem is what was done, so it, not the person, sets the gender:
      // وہ شکست دی گئی.
      if (verb.f && !verb.pu) agr = "f";
      var part = p[0] + perf(p[1], agr === "F" ? "f" : agr);
      return tense === "past"
        ? SUBJ[i] + " " + part + " " + perf("جا", agr)
        : SUBJ[i] + " " + part + " " + impf("جا", agr) + " " + AUX[i];
    }
    if (tense === "pres") return SUBJ[i] + " " + s[0] + impf(s[1], agr) + " " + AUX[i];
    if (verb.erg) return ERG[i] + " " + s[0] + perf(s[1], verb.f ? "f" : "m");
    if (verb.aux) return SUBJ[i] + " " + verb.ur + " " + perf(verb.aux, agr);
    return SUBJ[i] + " " + s[0] + perf(s[1], agr);
  }

  function infinitive(ur) {
    var s = split(ur);
    return s[0] + s[1].replace(/ے$/, "ی") + "نا";
  }

  /** Urdu under each of the six: past, present, command, masdar, doer, done-to. */
  function sixUrdu(verb) {
    var inf = infinitive(verb.ur);
    var s = split(verb.ur);
    return [
      urdu(verb, "past", false, 0),
      urdu(verb, "pres", false, 0),
      "تُو " + verb.ur,
      inf,
      inf.replace(/نا$/, "نے") + " والا",
      verb.six[5] ? s[0] + perf(s[1], "m") + " ہوا" : "لازم فعل"
    ];
  }

  /** The 14 صیغے of one tense: [{ pgn, ar, ur }]. */
  function table(verb, tense, passive) {
    var st = passive ? verb.pass : verb;
    return PGN.map(function (pgn, i) {
      return {
        pgn: pgn,
        ar: fixup(tense === "past" ? pastForm(st.past, pgn) : presForm(st.pres, pgn)),
        ur: urdu(verb, tense, passive, i)
      };
    });
  }

  /* ---------------- Hamza seats ---------------- */

  var HAMZA = /[ءأإؤئ]/;
  var MARK = /[ً-ْٰ]/;
  var RANK = { "ِ": 3, "ٍ": 3, "ُ": 2, "ٌ": 2, "َ": 1, "ً": 1, "ْ": 0 };

  /** Letters with their marks: "قَالَ" -> [["ق","َ"],["ا",""],["ل","َ"]]. */
  function units(word) {
    var out = [];
    for (var i = 0; i < word.length; i++) {
      if (MARK.test(word[i]) && out.length) out[out.length - 1][1] += word[i];
      else out.push([word[i], ""]);
    }
    return out;
  }

  function vowelOf(marks) {
    var m = marks.replace(/[ّٰ]/g, "");
    return m ? m[m.length - 1] : "";
  }

  /**
   * Forms are built with a bare ء wherever a hamza falls; this writes each on its seat the way
   * the vowels around it decide (يَأْخُذُ, يُؤْمِنُ, جِئْتَ, يَشَاؤُونَ), then folds the pairs
   * that standard spelling merges (أَأْ -> آ, أُؤْ -> أُو, إِئْ -> إِي).
   */
  function fixup(word) {
    var u = units(word);
    for (var k = 0; k < u.length; k++) {
      if (!HAMZA.test(u[k][0])) continue;
      var own = vowelOf(u[k][1]);
      var prev = u[k - 1];
      var seat;
      if (!prev) seat = own === "ِ" ? "إ" : "أ";
      else {
        var pv = vowelOf(prev[1]);
        var before = u[k - 2] ? vowelOf(u[k - 2][1]) : "";
        var longA = prev[0] === "ا" && !pv && before === "َ";
        var longY = prev[0] === "ي" && (!pv || pv === "ْ");
        var longW = prev[0] === "و" && !pv && before === "ُ";
        var last = k === u.length - 1;
        if (longA) seat = last ? "ء" : own === "ُ" ? "ؤ" : own === "ِ" ? "ئ" : "ء";
        else if (longY) seat = last ? "ء" : "ئ";
        else if (longW) seat = "ء";
        else {
          var r = last ? RANK[pv] : Math.max(RANK[own] || 0, RANK[pv] || 0);
          seat = r === 3 ? "ئ" : r === 2 ? "ؤ" : r === 1 ? "أ" : "ء";
        }
      }
      u[k][0] = seat;
    }
    return u.map(function (x) { return x[0] + x[1]; }).join("")
      .replace(/أَأْ/g, "آ").replace(/أَا/g, "آ").replace(/أُؤْ/g, "أُو").replace(/إِئْ/g, "إِي")
      .replace(/ُوْ/g, "ُو").replace(/ِيْ/g, "ِي").replace(/ِوْ/g, "ِي")
      .replace(/تْت/g, "تّ").replace(/نْن/g, "نّ").replace(/ُيْ/g, "ُو");
  }

  /* ---------------- Building a verb from its root and باب ---------------- */

  var A = "َ", I = "ِ", U = "ُ", O = "ْ", SH = "ّ", AN = "ً", IN = "ٍ", UN = "ٌ";

  /**
   * The stems and six forms of one verb from its root, its باب and, for ثلاثی مجرد, its two
   * vowels (vow: past then present, "au" = نَصَرَ يَنْصُرُ) and masdar. Weak roots follow the
   * usual classes: doubled (رَدَّ), hollow (قَالَ), defective (دَعَا, رَمَى, خَشِيَ) and a first
   * و dropped in the present (وَعَدَ يَعِدُ).
   */
  function derive(key, e) {
    var root = key.split("|")[0].replace(/أ/g, "ء").split("");
    var vf = Number(key.split("|")[1].replace(/#.*/, "").slice(2));
    if (root.length === 4) return finish(quad(root), e);
    var F = root[0], M = root[1], L = root[2];
    var weakL = L === "و" || L === "ي";
    // e.cls: a verb that keeps its weak letter sound (اِسْتَحْوَذَ, not اِسْتَحَاذَ).
    var cls = e.cls || (weakL ? "def" : M === L ? "dbl" : M === "و" || M === "ي" ? "hol" : "snd");
    var out = vf === 1 ? form1(F, M, L, cls, e.kw, e.vow[0] === "a" ? A : e.vow[0] === "i" ? I : U,
      e.vow[1] === "a" ? A : e.vow[1] === "i" ? I : U) : FORMS[vf](F, M, L, cls);
    return finish(out, e);
  }

  function finish(out, e) {
    if (e.m) out.six[3] = e.m;
    if (e.amr) out.six[2] = e.amr;
    if (e.pc) out.past.c = e.pc;
    if (e.l) out.six[5] = "";
    if (e.l && !e.p) out.pass = null;
    return out;
  }

  /** A four-letter root, رباعی مجرد: زَلْزَلَ يُزَلْزِلُ. */
  function quad(r) {
    var st = r[0] + A + r[1] + O + r[2];
    return withSix(s(st + A + r[3], st + A + r[3] + O), ps(U, st + I + r[3]), [st + I + r[3] + O,
      st + A + r[3] + A + "ة" + UN, "م" + U + st + I + r[3] + UN, "م" + U + st + A + r[3] + UN],
      { past: s(r[0] + U + r[1] + O + r[2] + I + r[3], r[0] + U + r[1] + O + r[2] + I + r[3] + O), pres: ps(U, st + A + r[3]) });
  }

  function six(past3, pres3, amr, masdar, act, pass) { return [past3, pres3, amr, masdar, act, pass]; }

  function form1(F, M, L, cls, kw, pa, pr) {
    var w = (pr === U ? "اُ" : "اِ");
    var o = {};
    if (cls === "snd") {
      // A first و drops in the present (وَعَدَ يَعِدُ) unless e.kw keeps it (وَجِلَ يَوْجَلُ).
      var drop = F === "و" && !kw;
      o.past = s(F + A + M + pa + L, F + A + M + pa + L + O);
      o.pres = ps(A, drop ? M + pr + L : F + O + M + pr + L);
      o.six = six(F + A + M + pa + L + A, "ي" + A + (drop ? M + pr + L : F + O + M + pr + L) + U,
        drop ? M + pr + L + O : w + F + O + M + pr + L + O, "",
        F + A + "ا" + M + I + L + UN, "م" + A + F + O + M + U + "و" + L + UN);
      o.pass = { past: s(F + U + M + I + L, F + U + M + I + L + O), pres: ps(U, F + O + M + A + L) };
    } else if (cls === "dbl") {
      o.past = s(F + A + M + SH, F + A + M + pa + M + O);
      o.pres = ps(A, F + pr + M + SH, F + O + M + pr + M);
      o.six = six(F + A + M + SH + A, "ي" + A + F + pr + M + SH + U, F + pr + M + SH + A, "",
        F + A + "ا" + M + SH + UN, "م" + A + F + O + M + U + "و" + M + UN);
      o.pass = { past: s(F + U + M + SH, F + U + M + I + M + O), pres: ps(U, F + A + M + SH, F + O + M + A + M) };
    } else if (cls === "hol") {
      var long = pr === U ? U + "و" : pr === I ? I + "ي" : A + "ا";
      o.past = s(F + A + "ا" + L, F + (pr === U ? U : I) + L + O);
      o.pres = ps(A, F + long + L, F + pr + L);
      // جَاءٍ, not جَائِئٌ: a final hamza after the ا ends like a defective verb.
      o.six = six(F + A + "ا" + L + A, "ي" + A + F + long + L + U, F + pr + L + O, "",
        L === "ء" ? F + A + "ا" + "ء" + IN : F + A + "ا" + "ء" + I + L + UN, "م" + A + F + (M === "و" ? U + "و" : I + "ي") + L + UN);
      o.pass = { past: s(F + I + "ي" + L, F + I + L + O), pres: ps(U, F + A + "ا" + L, F + A + L) };
    } else {
      o.past = pa === I ? { t: "i", r: F + A + M + I } : { t: L === "و" ? "aw" : "a", r: F + A + M + A };
      // وَقَى يَقِي, وَلِيَ يَلِي: a first و drops here too, before a present in ـِي.
      var lw = F === "و" && pr === I && !kw;
      var fo = lw ? "" : F + O;
      o.pres = pr === U ? { pv: A, t: "u", r: fo + M + U } : pr === I ? pi(A, fo + M + I) : pA(A, fo + M + A);
      var p3 = pa === I ? F + A + M + I + "يَ" : F + A + M + A + (L === "و" ? "ا" : "ى");
      var r3 = "ي" + A + fo + M + (pr === U ? U + "و" : pr === I ? I + "ي" : A + "ى");
      o.six = six(p3, r3, lw ? M + I : w + F + O + M + pr, "", F + A + "ا" + M + IN,
        "م" + A + F + O + M + (L === "و" && pa !== I ? U + "و" : I + "ي") + SH + UN);
      o.pass = { past: { t: "i", r: F + U + M + I }, pres: pA(U, F + O + M + A) };
    }
    return o;
  }

  /** The six and the stems from a past stem, present stem and the rest, for the derived ابواب. */
  function built(past, pres, sixForms, pass) { return { past: past, pres: pres, six: sixForms, pass: pass || null }; }

  function p3(st) { return pastForm(st, "3MS"); }
  function r3(st) { return presForm(st, "3MS"); }
  function withSix(past, pres, rest, pass) { return built(past, pres, [p3(past), r3(pres)].concat(rest), pass); }

  var FORMS = {
    2: function (F, M, L, cls) {
      var st = F + A + M + SH;
      if (cls === "def") {
        return withSix(pa(st + A), pi(U, st + I), [st + I, "ت" + A + F + O + M + I + "ي" + A + "ة" + UN,
          "م" + U + st + IN, "م" + U + st + AN + "ى"], { past: { t: "i", r: F + U + M + SH + I }, pres: pA(U, st + A) });
      }
      return withSix(s(st + A + L, st + A + L + O), ps(U, st + I + L), [st + I + L + O,
        "ت" + A + F + O + M + I + "ي" + L + UN, "م" + U + st + I + L + UN, "م" + U + st + A + L + UN],
        { past: s(F + U + M + SH + I + L, F + U + M + SH + I + L + O), pres: ps(U, st + A + L) });
    },
    3: function (F, M, L, cls) {
      var st = F + A + "ا" + M;
      if (cls === "dbl") {
        return withSix(s(st + SH, st + A + M + O), ps(U, st + SH, st + I + M), [st + SH + A,
          "م" + U + st + SH + A + "ة" + UN, "م" + U + st + SH + UN, "م" + U + st + SH + UN]);
      }
      if (cls === "def") {
        return withSix(pa(st + A), pi(U, st + I), [st + I, "م" + U + st + A + "ا" + "ة" + UN,
          "م" + U + st + IN, "م" + U + st + AN + "ى"]);
      }
      return withSix(s(st + A + L, st + A + L + O), ps(U, st + I + L), [st + I + L + O,
        "م" + U + st + A + L + A + "ة" + UN, "م" + U + st + I + L + UN, "م" + U + st + A + L + UN],
        { past: s(F + U + "و" + M + I + L, F + U + "و" + M + I + L + O), pres: ps(U, st + A + L) });
    },
    4: function (F, M, L, cls) {
      var h = "ء" + A;
      if (cls === "hol") {
        return withSix(s(h + F + A + "ا" + L, h + F + A + L + O), ps(U, F + I + "ي" + L, F + I + L),
          [h + F + I + L + O, "ء" + I + F + A + "ا" + L + A + "ة" + UN, "م" + U + F + I + "ي" + L + UN, "م" + U + F + A + "ا" + L + UN],
          { past: s("ء" + U + F + I + "ي" + L, "ء" + U + F + I + L + O), pres: ps(U, F + A + "ا" + L, F + A + L) });
      }
      if (cls === "dbl") {
        return withSix(s(h + F + A + M + SH, h + F + O + M + A + M + O), ps(U, F + I + M + SH, F + O + M + I + M),
          [h + F + I + M + SH + A, "ء" + I + F + O + M + A + "ا" + M + UN, "م" + U + F + I + M + SH + UN, "م" + U + F + A + M + SH + UN],
          { past: s("ء" + U + F + I + M + SH, "ء" + U + F + O + M + I + M + O), pres: ps(U, F + A + M + SH, F + O + M + A + M) });
      }
      if (cls === "def") {
        return withSix(pa(h + F + O + M + A), pi(U, F + O + M + I), [h + F + O + M + I,
          "ء" + I + F + O + M + A + "ا" + "ء" + UN, "م" + U + F + O + M + IN, "م" + U + F + O + M + AN + "ى"],
          { past: { t: "i", r: "ء" + U + F + O + M + I }, pres: pA(U, F + O + M + A) });
      }
      return withSix(s(h + F + O + M + A + L, h + F + O + M + A + L + O), ps(U, F + O + M + I + L),
        [h + F + O + M + I + L + O, "ء" + I + F + O + M + A + "ا" + L + UN, "م" + U + F + O + M + I + L + UN, "م" + U + F + O + M + A + L + UN],
        { past: s("ء" + U + F + O + M + I + L, "ء" + U + F + O + M + I + L + O), pres: ps(U, F + O + M + A + L) });
    },
    5: function (F, M, L, cls) {
      var st = "ت" + A + F + A + M + SH;
      if (cls === "def") {
        return withSix(pa(st + A), pA(A, st + A), [st + A, st + IN, "م" + U + st + IN, "م" + U + st + AN + "ى"]);
      }
      return withSix(s(st + A + L, st + A + L + O), ps(A, st + A + L), [st + A + L + O, st + U + L + UN,
        "م" + U + st + I + L + UN, "م" + U + st + A + L + UN]);
    },
    6: function (F, M, L, cls) {
      var st = "ت" + A + F + A + "ا" + M;
      if (cls === "dbl") {
        return withSix(s(st + SH, st + A + M + O), ps(A, st + SH, st + A + M), [st + SH + A, st + SH + UN,
          "م" + U + st + SH + UN, ""]);
      }
      if (cls === "def") {
        return withSix(pa(st + A), pA(A, st + A), [st + A, st + IN, "م" + U + st + IN, ""]);
      }
      return withSix(s(st + A + L, st + A + L + O), ps(A, st + A + L), [st + A + L + O, st + U + L + UN,
        "م" + U + st + I + L + UN, ""]);
    },
    7: function (F, M, L, cls) {
      if (cls === "def") {
        return withSix(pa("اِنْ" + F + A + M + A), pi(A, "نْ" + F + A + M + I), ["اِنْ" + F + A + M + I,
          "اِنْ" + F + I + M + A + "ا" + "ء" + UN, "مُنْ" + F + A + M + IN, ""]);
      }
      if (cls === "hol") {
        return withSix(s("اِنْ" + F + A + "ا" + L, "اِنْ" + F + A + L + O), ps(A, "نْ" + F + A + "ا" + L, "نْ" + F + A + L),
          ["اِنْ" + F + A + L + O, "اِنْ" + F + I + "ي" + A + "ا" + L + UN, "مُنْ" + F + A + "ا" + L + UN, ""]);
      }
      if (cls === "dbl") {
        return withSix(s("اِنْ" + F + A + M + SH, "اِنْ" + F + A + M + A + M + O), ps(A, "نْ" + F + A + M + SH, "نْ" + F + A + M + I + M),
          ["اِنْ" + F + A + M + I + M + O, "اِنْ" + F + I + M + A + "ا" + M + UN, "مُنْ" + F + A + M + SH + UN, ""]);
      }
      return withSix(s("اِنْ" + F + A + M + A + L, "اِنْ" + F + A + M + A + L + O), ps(A, "نْ" + F + A + M + I + L),
        ["اِنْ" + F + A + M + I + L + O, "اِنْ" + F + I + M + A + "ا" + L + UN, "مُنْ" + F + A + M + I + L + UN, ""]);
    },
    8: function (F, M, L, cls) {
      var ft = F === "و" || F === "ت" ? "ت" + SH : F === "ط" ? "ط" + SH : /[صضظ]/.test(F) ? F + O + "ط" :
        /[دذ]/.test(F) ? "د" + SH : F === "ز" ? F + O + "د" : F + O + "ت";
      if (cls === "hol") {
        return withSix(s("اِ" + ft + A + "ا" + L, "اِ" + ft + A + L + O), ps(A, ft + A + "ا" + L, ft + A + L),
          ["اِ" + ft + A + L + O, "اِ" + ft + I + "ي" + A + "ا" + L + UN, "مُ" + ft + A + "ا" + L + UN, ""]);
      }
      if (cls === "dbl") {
        return withSix(s("اِ" + ft + A + M + SH, "اِ" + ft + A + M + A + M + O), ps(A, ft + A + M + SH, ft + A + M + I + M),
          ["اِ" + ft + A + M + SH + A, "اِ" + ft + I + M + A + "ا" + M + UN, "مُ" + ft + A + M + SH + UN, "مُ" + ft + A + M + SH + UN],
          { past: s("اُ" + ft + U + M + SH, "اُ" + ft + U + M + I + M + O), pres: ps(U, ft + A + M + SH, ft + A + M + A + M) });
      }
      if (cls === "def") {
        return withSix(pa("اِ" + ft + A + M + A), pi(A, ft + A + M + I), ["اِ" + ft + A + M + I,
          "اِ" + ft + I + M + A + "ا" + "ء" + UN, "م" + U + ft + A + M + IN, "م" + U + ft + A + M + AN + "ى"],
          { past: { t: "i", r: "اُ" + ft + U + M + I }, pres: pA(U, ft + A + M + A) });
      }
      return withSix(s("اِ" + ft + A + M + A + L, "اِ" + ft + A + M + A + L + O), ps(A, ft + A + M + I + L),
        ["اِ" + ft + A + M + I + L + O, "اِ" + ft + I + M + A + "ا" + L + UN, "م" + U + ft + A + M + I + L + UN, "م" + U + ft + A + M + A + L + UN],
        { past: s("اُ" + ft + U + M + I + L, "اُ" + ft + U + M + I + L + O), pres: ps(U, ft + A + M + A + L) });
    },
    9: function (F, M, L) {
      return withSix(s("اِ" + F + O + M + A + L + SH, "اِ" + F + O + M + A + L + A + L + O), ps(A, F + O + M + A + L + SH, F + O + M + A + L + I + L),
        ["اِ" + F + O + M + A + L + SH + A, "اِ" + F + O + M + I + L + A + "ا" + L + UN, "م" + U + F + O + M + A + L + SH + UN, ""]);
    },
    10: function (F, M, L, cls) {
      var x = "اِسْتَ", y = "سْتَ";
      if (cls === "hol") {
        return withSix(s(x + F + A + "ا" + L, x + F + A + L + O), ps(A, y + F + I + "ي" + L, y + F + I + L),
          [x + F + I + L + O, "اِسْتِ" + F + A + "ا" + L + A + "ة" + UN, "مُسْتَ" + F + I + "ي" + L + UN, "مُسْتَ" + F + A + "ا" + L + UN],
          { past: s("اُسْتُ" + F + I + "ي" + L, "اُسْتُ" + F + I + L + O), pres: ps(U, y + F + A + "ا" + L, y + F + A + L) });
      }
      if (cls === "dbl") {
        return withSix(s(x + F + A + M + SH, x + F + O + M + A + M + O), ps(A, y + F + I + M + SH, y + F + O + M + I + M),
          [x + F + O + M + I + M + O, "اِسْتِ" + F + O + M + A + "ا" + M + UN, "مُسْتَ" + F + I + M + SH + UN, "مُسْتَ" + F + A + M + SH + UN]);
      }
      if (cls === "def") {
        return withSix(pa(x + F + O + M + A), pi(A, y + F + O + M + I), [x + F + O + M + I,
          "اِسْتِ" + F + O + M + A + "ا" + "ء" + UN, "مُسْتَ" + F + O + M + IN, "مُسْتَ" + F + O + M + AN + "ى"]);
      }
      return withSix(s(x + F + O + M + A + L, x + F + O + M + A + L + O), ps(A, y + F + O + M + I + L),
        [x + F + O + M + I + L + O, "اِسْتِ" + F + O + M + A + "ا" + L + UN, "مُسْتَ" + F + O + M + I + L + UN, "مُسْتَ" + F + O + M + A + L + UN],
        { past: s("اُسْتُ" + F + O + M + I + L, "اُسْتُ" + F + O + M + I + L + O), pres: ps(U, y + F + O + M + A + L) });
    }
  };

  function s(v, c) { return { t: "s", v: v, c: c }; }
  function ps(pv, b, c) { return { pv: pv, t: "s", b: b, c: c }; }
  function pa(r) { return { t: "a", r: r }; }
  function pi(pv, r) { return { pv: pv, t: "i", r: r }; }
  function pA(pv, r) { return { pv: pv, t: "a", r: r }; }

  var VERBS = {
    "ذكر|VF1": { past: s("ذَكَر", "ذَكَرْ"), pres: ps("َ", "ذْكُر"), ur: "یاد کر", erg: true,
      six: ["ذَكَرَ", "يَذْكُرُ", "اُذْكُرْ", "ذِكْرٌ", "ذَاكِرٌ", "مَذْكُورٌ"] },
    "فكر|VF5": { past: s("تَفَكَّر", "تَفَكَّرْ"), pres: ps("َ", "تَفَكَّر"), ur: "غور کر", erg: true,
      six: ["تَفَكَّرَ", "يَتَفَكَّرُ", "تَفَكَّرْ", "تَفَكُّرٌ", "مُتَفَكِّرٌ", ""] },
    "خلق|VF1": { past: s("خَلَق", "خَلَقْ"), pres: ps("َ", "خْلُق"), ur: "پیدا کر", erg: true,
      six: ["خَلَقَ", "يَخْلُقُ", "اُخْلُقْ", "خَلْقٌ", "خَالِقٌ", "مَخْلُوقٌ"] },
    "وقي|VF1": { past: pa("وَقَ"), pres: pi("َ", "قِ"), ur: "بچا", erg: true,
      six: ["وَقَى", "يَقِي", "قِ", "وِقَايَةٌ", "وَاقٍ", "مَوْقِيٌّ"] },
    "دخل|VF4": { past: s("أَدْخَل", "أَدْخَلْ"), pres: ps("ُ", "دْخِل"), ur: "داخل کر", erg: true,
      six: ["أَدْخَلَ", "يُدْخِلُ", "أَدْخِلْ", "إِدْخَالٌ", "مُدْخِلٌ", "مُدْخَلٌ"] },
    "خزي|VF4": { past: pa("أَخْزَ"), pres: pi("ُ", "خْزِ"), ur: "رسوا کر", erg: true,
      six: ["أَخْزَى", "يُخْزِي", "أَخْزِ", "إِخْزَاءٌ", "مُخْزٍ", "مُخْزًى"] },
    "سمع|VF1": { past: s("سَمِع", "سَمِعْ"), pres: ps("َ", "سْمَع"), ur: "سن", erg: true,
      six: ["سَمِعَ", "يَسْمَعُ", "اِسْمَعْ", "سَمْعٌ", "سَامِعٌ", "مَسْمُوعٌ"] },
    "ندي|VF3": { past: pa("نَادَ"), pres: pi("ُ", "نَادِ"), ur: "پکار", erg: true,
      six: ["نَادَى", "يُنَادِي", "نَادِ", "نِدَاءٌ", "مُنَادٍ", "مُنَادًى"] },
    "أمن|VF4": { past: s("آمَن", "آمَنْ"), pres: ps("ُ", "ؤْمِن"), ur: "ایمان لا",
      six: ["آمَنَ", "يُؤْمِنُ", "آمِنْ", "إِيمَانٌ", "مُؤْمِنٌ", ""] },
    "غفر|VF1": { past: s("غَفَر", "غَفَرْ"), pres: ps("َ", "غْفِر"), ur: "بخش", erg: true,
      six: ["غَفَرَ", "يَغْفِرُ", "اِغْفِرْ", "مَغْفِرَةٌ", "غَافِرٌ", "مَغْفُورٌ"] },
    "كفر|VF2": { past: s("كَفَّر", "كَفَّرْ"), pres: ps("ُ", "كَفِّر"), ur: "دور کر", erg: true,
      six: ["كَفَّرَ", "يُكَفِّرُ", "كَفِّرْ", "تَكْفِيرٌ", "مُكَفِّرٌ", "مُكَفَّرٌ"] },
    "وفي|VF5": { past: pa("تَوَفَّ"), pres: pA("َ", "تَوَفَّ"), ur: "وفات دے", erg: true, f: true,
      six: ["تَوَفَّى", "يَتَوَفَّى", "تَوَفَّ", "تَوَفٍّ", "مُتَوَفٍّ", "مُتَوَفًّى"] },
    "أتي|VF4": { past: pa("آتَ"), pres: pi("ُ", "ؤْتِ"), ur: "دے", erg: true,
      six: ["آتَى", "يُؤْتِي", "آتِ", "إِيتَاءٌ", "مُؤْتٍ", "مُؤْتًى"] },
    "وعد|VF1": { past: s("وَعَد", "وَعَدْ"), pres: ps("َ", "عِد"), ur: "وعدہ کر", erg: true,
      six: ["وَعَدَ", "يَعِدُ", "عِدْ", "وَعْدٌ", "وَاعِدٌ", "مَوْعُودٌ"] },
    "خلف|VF4": { past: s("أَخْلَف", "أَخْلَفْ"), pres: ps("ُ", "خْلِف"), ur: "خلاف ورزی کر", erg: true, f: true,
      six: ["أَخْلَفَ", "يُخْلِفُ", "أَخْلِفْ", "إِخْلَافٌ", "مُخْلِفٌ", "مُخْلَفٌ"] },
    "جوب|VF10": { past: s("اِسْتَجَاب", "اِسْتَجَبْ"), pres: ps("َ", "سْتَجِيب", "سْتَجِب"), ur: "قبول کر", erg: true,
      six: ["اِسْتَجَابَ", "يَسْتَجِيبُ", "اِسْتَجِبْ", "اِسْتِجَابَةٌ", "مُسْتَجِيبٌ", "مُسْتَجَابٌ"] },
    "ضيع|VF4": { past: s("أَضَاع", "أَضَعْ"), pres: ps("ُ", "ضِيع", "ضِع"), ur: "ضائع کر", erg: true,
      six: ["أَضَاعَ", "يُضِيعُ", "أَضِعْ", "إِضَاعَةٌ", "مُضِيعٌ", "مُضَاعٌ"] },
    "هجر|VF3": { past: s("هَاجَر", "هَاجَرْ"), pres: ps("ُ", "هَاجِر"), ur: "ہجرت کر", erg: true, f: true,
      six: ["هَاجَرَ", "يُهَاجِرُ", "هَاجِرْ", "مُهَاجَرَةٌ", "مُهَاجِرٌ", ""] },
    "خرج|VF4": { past: s("أَخْرَج", "أَخْرَجْ"), pres: ps("ُ", "خْرِج"), ur: "نکال", erg: true,
      six: ["أَخْرَجَ", "يُخْرِجُ", "أَخْرِجْ", "إِخْرَاجٌ", "مُخْرِجٌ", "مُخْرَجٌ"],
      pass: { past: s("أُخْرِج", "أُخْرِجْ"), pres: ps("ُ", "خْرَج") } },
    "أذي|VF4": { past: pa("آذَ"), pres: pi("ُ", "ؤْذِ"), ur: "ستا", erg: true,
      six: ["آذَى", "يُؤْذِي", "آذِ", "إِيذَاءٌ", "مُؤْذٍ", "مُؤْذًى"],
      pass: { past: { t: "i", r: "أُوذِ" }, pres: pA("ُ", "ؤْذَ") } },
    "قتل|VF3": { past: s("قَاتَل", "قَاتَلْ"), pres: ps("ُ", "قَاتِل"), ur: "لڑ",
      six: ["قَاتَلَ", "يُقَاتِلُ", "قَاتِلْ", "قِتَالٌ", "مُقَاتِلٌ", "مُقَاتَلٌ"] },
    "قتل|VF1": { past: s("قَتَل", "قَتَلْ"), pres: ps("َ", "قْتُل"), ur: "قتل کر", erg: true,
      six: ["قَتَلَ", "يَقْتُلُ", "اُقْتُلْ", "قَتْلٌ", "قَاتِلٌ", "مَقْتُولٌ"],
      pass: { past: s("قُتِل", "قُتِلْ"), pres: ps("ُ", "قْتَل") } },
    "كفر|VF1": { past: s("كَفَر", "كَفَرْ"), pres: ps("َ", "كْفُر"), ur: "کفر کر", erg: true,
      six: ["كَفَرَ", "يَكْفُرُ", "اُكْفُرْ", "كُفْرٌ", "كَافِرٌ", "مَكْفُورٌ"] },
    "جري|VF1": { past: pa("جَرَ"), pres: pi("َ", "جْرِ"), ur: "بہ",
      six: ["جَرَى", "يَجْرِي", "اِجْرِ", "جَرْيٌ", "جَارٍ", ""] },
    "غرر|VF1": { past: s("غَرّ", "غَرَرْ"), pres: ps("َ", "غُرّ", "غْرُر"), ur: "دھوکا دے", erg: true,
      six: ["غَرَّ", "يَغُرُّ", "غُرَّ", "غُرُورٌ", "غَارٌّ", "مَغْرُورٌ"] },
    "وقي|VF8": { past: pa("اِتَّقَ"), pres: pi("َ", "تَّقِ"), ur: "ڈر",
      six: ["اِتَّقَى", "يَتَّقِي", "اِتَّقِ", "اِتِّقَاءٌ", "مُتَّقٍ", ""] },
    "نزل|VF4": { past: s("أَنْزَل", "أَنْزَلْ"), pres: ps("ُ", "نْزِل"), ur: "اتار", erg: true,
      six: ["أَنْزَلَ", "يُنْزِلُ", "أَنْزِلْ", "إِنْزَالٌ", "مُنْزِلٌ", "مُنْزَلٌ"],
      pass: { past: s("أُنْزِل", "أُنْزِلْ"), pres: ps("ُ", "نْزَل") } },
    "شري|VF8": { past: pa("اِشْتَرَ"), pres: pi("َ", "شْتَرِ"), ur: "خرید", erg: true,
      six: ["اِشْتَرَى", "يَشْتَرِي", "اِشْتَرِ", "اِشْتِرَاءٌ", "مُشْتَرٍ", "مُشْتَرًى"] },
    "صبر|VF1": { past: s("صَبَر", "صَبَرْ"), pres: ps("َ", "صْبِر"), ur: "صبر کر", erg: true,
      six: ["صَبَرَ", "يَصْبِرُ", "اِصْبِرْ", "صَبْرٌ", "صَابِرٌ", ""] },
    "صبر|VF3": { past: s("صَابَر", "صَابَرْ"), pres: ps("ُ", "صَابِر"), ur: "مقابلے میں صبر کر", erg: true,
      six: ["صَابَرَ", "يُصَابِرُ", "صَابِرْ", "مُصَابَرَةٌ", "مُصَابِرٌ", ""] },
    "ربط|VF3": { past: s("رَابَط", "رَابَطْ"), pres: ps("ُ", "رَابِط"), ur: "تیار رہ",
      six: ["رَابَطَ", "يُرَابِطُ", "رَابِطْ", "مُرَابَطَةٌ", "مُرَابِطٌ", ""] },
    "طمأن|VF4": { past: s("اِطْمَأَنّ", "اِطْمَأْنَنْ"), pres: ps("َ", "طْمَئِنّ", "طْمَأْنِن"), ur: "مطمئن ہو",
      six: ["اِطْمَأَنَّ", "يَطْمَئِنُّ", "اِطْمَئِنَّ", "اِطْمِئْنَانٌ", "مُطْمَئِنٌّ", ""] },
    "زحزح|VF1": { past: s("زَحْزَح", "زَحْزَحْ"), pres: ps("ُ", "زَحْزِح"), ur: "دور کر", erg: true,
      six: ["زَحْزَحَ", "يُزَحْزِحُ", "زَحْزِحْ", "زَحْزَحَةٌ", "مُزَحْزِحٌ", "مُزَحْزَحٌ"],
      pass: { past: s("زُحْزِح", "زُحْزِحْ"), pres: ps("ُ", "زَحْزَح") } },
    "أخذ|VF8": { past: s("اِتَّخَذ", "اِتَّخَذْ"), pres: ps("َ", "تَّخِذ"), ur: "بنا", erg: true,
      six: ["اِتَّخَذَ", "يَتَّخِذُ", "اِتَّخِذْ", "اِتِّخَاذٌ", "مُتَّخِذٌ", "مُتَّخَذٌ"] },
    "رأي|VF1": { past: pa("رَأَ"), pres: pA("َ", "رَ"), ur: "دیکھ", erg: true,
      six: ["رَأَى", "يَرَى", "رَ", "رُؤْيَةٌ", "رَاءٍ", "مَرْئِيٌّ"] },
    // The corpus files تَعَالَوْا under باب افعال; it is تَعَالَى of باب تفاعل.
    "علو|VF4": { past: pa("تَعَالَ"), pres: pA("َ", "تَعَالَ"), ur: "آ",
      six: ["تَعَالَى", "يَتَعَالَى", "تَعَالَ", "تَعَالٍ", "مُتَعَالٍ", ""] },
    "رأي|VF4": { past: pa("أَرَ"), pres: pi("ُ", "رِ"), ur: "دکھا", erg: true,
      six: ["أَرَى", "يُرِي", "أَرِ", "إِرَاءَةٌ", "مُرٍ", "مُرًى"] },
    // تَدَارَأَ with its ت run into the د: اِدَّارَأَ.
    "درأ|VF6": { past: s("اِدَّارَء", "اِدَّارَءْ"), pres: ps("َ", "دَّارَء"), ur: "ایک دوسرے پر ڈال", erg: true,
      six: ["اِدَّارَأَ", "يَدَّارَأُ", "اِدَّارَأْ", "اِدَّارُؤٌ", "مُدَّارِئٌ", ""] },
    // A four-letter root in باب افعلّال: اِقْشَعَرَّ يَقْشَعِرُّ.
    "قشعر|VF4": { past: s("اِقْشَعَرّ", "اِقْشَعْرَرْ"), pres: ps("َ", "قْشَعِرّ", "قْشَعْرِر"), ur: "رونگٹے کھڑے ہو",
      six: ["اِقْشَعَرَّ", "يَقْشَعِرُّ", "اِقْشَعِرَّ", "اِقْشِعْرَارٌ", "مُقْشَعِرٌّ", ""] },
    "شمز|VF8": { past: s("اِشْمَأَزّ", "اِشْمَأْزَزْ"), pres: ps("َ", "شْمَئِزّ", "شْمَأْزِز"), ur: "نفرت کر", erg: true, f: true,
      six: ["اِشْمَأَزَّ", "يَشْمَئِزُّ", "اِشْمَئِزَّ", "اِشْمِئْزَازٌ", "مُشْمَئِزٌّ", ""] },
    "فلح|VF4": { past: s("أَفْلَح", "أَفْلَحْ"), pres: ps("ُ", "فْلِح"), ur: "فلاح پا", aux: "جا",
      six: ["أَفْلَحَ", "يُفْلِحُ", "أَفْلِحْ", "إِفْلَاحٌ", "مُفْلِحٌ", ""] }
  };

  /*
   * Para 4's other verbs, built by derive(): [key, flags, Urdu, ثلاثی مجرد vowels, masdar, extra].
   * Flags: e past takes نے, f that past agrees with a feminine object, l لازم (no اسم مفعول and
   * no مجہول), p a مجہول even so, x past with the helper جا. extra.pu is the Urdu stem for the
   * مجہول where the active one will not bend that way (لوٹ -> لوٹایا گیا); extra.amr and
   * extra.pc replace the امر and the past stem before -تُ where the rule is not followed (خُذْ, مِتُّ);
   * extra.cls forces a weak root's class ("snd": اِسْتَحْوَذَ); extra.kw keeps a first و (يَوْجَلُ).
   */
  var MORE = [
    ["طوع|VF4", "ef", "اطاعت کر"],
    ["ردد|VF1", "e", "پھیر", "au", "رَدٌّ"],
    ["تلو|VF1", "ef", "تلاوت کر", "au", "تِلَاوَةٌ"],
    ["عصم|VF8", "el", "مضبوطی سے تھام"],
    ["هدي|VF1", "ef", "ہدایت دے", "ai", "هُدًى"],
    ["موت|VF1", "l", "مر", "au", "مَوْتٌ"],
    ["فرق|VF5", "l", "الگ الگ ہو"],
    ["كون|VF1", "l", "ہو", "au", "كَوْنٌ"],
    ["ألف|VF2", "ef", "الفت ڈال"],
    ["صبح|VF4", "l", "ہو جا"],
    ["نقذ|VF4", "e", "بچا"],
    ["بين|VF2", "e", "واضح کر"],
    ["هدي|VF8", "efl", "ہدایت پا"],
    ["دعو|VF1", "e", "پکار", "au", "دُعَاءٌ"],
    ["أمر|VF1", "e", "حکم دے", "au", "أَمْرٌ", { amr: "مُرْ" }],
    ["نهي|VF1", "e", "روک", "aa", "نَهْيٌ"],
    ["خلف|VF8", "el", "اختلاف کر"],
    ["جيأ|VF1", "l", "آ", "ai", "مَجِيءٌ"],
    ["بيض|VF9", "l", "سفید ہو"],
    ["سود|VF9", "l", "سیاہ ہو"],
    ["ذوق|VF1", "e", "چکھ", "au", "ذَوْقٌ"],
    ["رود|VF4", "e", "چاہ"],
    ["رجع|VF1", "lp", "لوٹ", "ai", "رُجُوعٌ", { pu: "لوٹا" }],
    ["ضرر|VF1", "e", "نقصان پہنچا", "au", "ضَرٌّ"],
    ["ولي|VF2", "e", "پھیر"],
    ["نصر|VF1", "ef", "مدد کر", "au", "نَصْرٌ"],
    ["ضرب|VF1", "e", "مار", "ai", "ضَرْبٌ"],
    ["ثقف|VF1", "e", "پا", "ia", "ثَقْفٌ"],
    ["بوأ|VF1", "l", "لوٹ", "au", "بَوْءٌ"],
    ["عصي|VF1", "ef", "نافرمانی کر", "ai", "مَعْصِيَةٌ"],
    ["عدو|VF8", "l", "حد سے بڑھ"],
    ["سجد|VF1", "el", "سجدہ کر", "au", "سُجُودٌ"],
    ["سرع|VF3", "efl", "جلدی کر"],
    ["فعل|VF1", "e", "کر", "aa", "فِعْلٌ"],
    ["غني|VF4", "l", "کام آ"],
    ["نفق|VF4", "e", "خرچ کر"],
    ["صوب|VF4", "l", "پہنچ"],
    ["ظلم|VF1", "e", "ظلم کر", "ai", "ظُلْمٌ"],
    ["هلك|VF4", "e", "ہلاک کر"],
    ["ألو|VF1", "efl", "کمی کر", "au", "أَلْوٌ"],
    ["ودد|VF1", "e", "چاہ", "ia", "وُدٌّ"],
    ["عنت|VF1", "l", "مشقت میں پڑ", "ia", "عَنَتٌ"],
    ["بدو|VF1", "l", "ظاہر ہو", "au", "بُدُوٌّ"],
    ["خفي|VF4", "e", "چھپا"],
    ["عقل|VF1", "e", "سمجھ", "ai", "عَقْلٌ"],
    ["حبب|VF4", "ef", "محبت کر"],
    ["لقي|VF1", "l", "مل", "ia", "لِقَاءٌ"],
    ["قول|VF1", "e", "کہ", "au", "قَوْلٌ"],
    ["خلو|VF1", "l", "گزر", "au", "خُلُوٌّ"],
    ["عضض|VF1", "e", "کاٹ", "ia", "عَضٌّ"],
    ["مسس|VF1", "e", "چھو", "ia", "مَسٌّ"],
    ["سوأ|VF1", "l", "برا لگ", "au", "سُوءٌ"],
    ["فرح|VF1", "l", "خوش ہو", "ia", "فَرَحٌ"],
    ["عمل|VF1", "e", "عمل کر", "ia", "عَمَلٌ"],
    ["غدو|VF1", "l", "صبح سویرے نکل", "au", "غُدُوٌّ"],
    ["بوأ|VF2", "e", "ٹھکانے پر بٹھا"],
    ["همم|VF1", "e", "ارادہ کر", "au", "هَمٌّ"],
    ["فشل|VF1", "efl", "ہمت ہار", "ia", "فَشَلٌ"],
    ["وكل|VF5", "el", "بھروسا کر"],
    ["شكر|VF1", "e", "شکر کر", "au", "شُكْرٌ"],
    ["كفي|VF1", "l", "کافی ہو", "ai", "كِفَايَةٌ"],
    ["مدد|VF4", "ef", "مدد کر"],
    ["أتي|VF1", "l", "آ", "ai", "إِتْيَانٌ"],
    ["جعل|VF1", "e", "بنا", "aa", "جَعْلٌ"],
    ["قطع|VF1", "e", "کاٹ", "aa", "قَطْعٌ"],
    ["كبت|VF1", "e", "ذلیل کر", "ai", "كَبْتٌ"],
    ["قلب|VF7", "l", "پلٹ"],
    ["توب|VF1", "efl", "توبہ کر", "au", "تَوْبَةٌ"],
    ["عذب|VF2", "e", "عذاب دے"],
    ["شيأ|VF1", "e", "چاہ", "aa", "مَشِيئَةٌ"],
    ["أكل|VF1", "e", "کھا", "au", "أَكْلٌ", { amr: "كُلْ" }],
    ["عدد|VF4", "e", "تیار کر"],
    ["رحم|VF1", "e", "رحم کر", "ia", "رَحْمَةٌ"],
    ["غفر|VF10", "ef", "بخشش مانگ"],
    ["صرر|VF4", "el", "اصرار کر"],
    ["علم|VF1", "e", "جان", "ia", "عِلْمٌ"],
    ["سير|VF1", "l", "چل", "ai", "سَيْرٌ"],
    ["نظر|VF1", "e", "دیکھ", "au", "نَظَرٌ"],
    ["وهن|VF1", "l", "کمزور پڑ", "ai", "وَهْنٌ"],
    ["حزن|VF1", "l", "غمگین ہو", "ia", "حُزْنٌ"],
    ["دول|VF3", "e", "پھیر"],
    ["محص|VF2", "e", "خالص کر"],
    ["محق|VF1", "e", "مٹا", "aa", "مَحْقٌ"],
    ["حسب|VF1", "e", "گمان کر", "ia", "حِسْبَانٌ"],
    ["دخل|VF1", "l", "داخل ہو", "au", "دُخُولٌ"],
    ["جهد|VF3", "el", "جہاد کر", null, "جِهَادٌ"],
    ["مني|VF5", "ef", "تمنا کر"],
    ["جزي|VF1", "e", "بدلہ دے", "ai", "جَزَاءٌ"],
    ["ضعف|VF1", "l", "کمزور پڑ", "uu", "ضَعْفٌ"],
    ["كين|VF10", "lx", "دب"],
    ["ثبت|VF2", "e", "جما"],
    ["لقي|VF4", "e", "ڈال"],
    ["شرك|VF4", "e", "شریک ٹھہرا"],
    ["نزل|VF2", "e", "اتار"],
    ["صدق|VF1", "e", "سچ کر دکھا", "au", "صِدْقٌ"],
    ["حسس|VF1", "e", "قتل کر", "au", "حَسٌّ"],
    ["نزع|VF6", "el", "جھگڑا کر"],
    ["صرف|VF1", "e", "پھیر", "ai", "صَرْفٌ"],
    ["بلو|VF8", "e", "آزما"],
    ["عفو|VF1", "e", "معاف کر", "au", "عَفْوٌ"],
    ["صعد|VF4", "l", "چڑھ"],
    ["لوي|VF1", "el", "مڑ کر دیکھ", "ai", "لَيٌّ"],
    ["ثوب|VF4", "e", "عطا کر"],
    ["فوت|VF1", "l", "ہاتھ سے نکل", "au", "فَوْتٌ"],
    ["غشو|VF1", "e", "ڈھانپ", "ia", "غِشَاوَةٌ"],
    ["همم|VF4", "e", "فکر میں ڈال"],
    ["ظنن|VF1", "e", "گمان کر", "au", "ظَنٌّ"],
    ["بدو|VF4", "e", "ظاہر کر"],
    ["برز|VF1", "l", "نکل", "au", "بُرُوزٌ"],
    ["كتب|VF1", "e", "لکھ", "au", "كِتَابَةٌ"],
    ["ولي|VF5", "e", "منہ پھیر"],
    ["لقي|VF8", "l", "آمنے سامنے ہو"],
    ["زلل|VF10", "e", "پھسلا"],
    ["كسب|VF1", "e", "کما", "ai", "كَسْبٌ"],
    ["حيي|VF4", "e", "زندہ کر"],
    ["موت|VF4", "ef", "موت دے"],
    ["جمع|VF1", "e", "جمع کر", "aa", "جَمْعٌ"],
    ["حشر|VF1", "e", "اکٹھا کر", "au", "حَشْرٌ"],
    ["لين|VF1", "l", "نرم ہو", "ai", "لِينٌ"],
    ["فضض|VF7", "l", "منتشر ہو"],
    ["شور|VF3", "e", "مشورہ کر"],
    ["عزم|VF1", "e", "پختہ ارادہ کر", "ai", "عَزْمٌ"],
    ["خذل|VF1", "e", "بے یار و مددگار چھوڑ", "au", "خِذْلَانٌ"],
    ["غلل|VF1", "ef", "خیانت کر", "au", "غُلُولٌ"],
    ["وفي|VF2", "e", "پورا دے"],
    ["تبع|VF8", "ef", "پیروی کر"],
    ["منن|VF1", "e", "احسان کر", "au", "مَنٌّ"],
    ["بعث|VF1", "e", "بھیج", "aa", "بَعْثٌ"],
    ["زكو|VF2", "e", "پاک کر"],
    ["علم|VF2", "e", "سکھا"],
    ["نفق|VF3", "efl", "منافقت کر", null, "نِفَاقٌ"],
    ["دفع|VF1", "e", "دور کر", "aa", "دَفْعٌ"],
    ["كتم|VF1", "e", "چھپا", "au", "كِتْمَانٌ"],
    ["قعد|VF1", "l", "بیٹھ", "au", "قُعُودٌ"],
    ["درأ|VF1", "e", "ہٹا", "aa", "دَرْءٌ"],
    ["رزق|VF1", "e", "رزق دے", "au", "رِزْقٌ"],
    ["بشر|VF10", "l", "خوش ہو"],
    ["لحق|VF1", "l", "آ مل", "ia", "لُحُوقٌ"],
    ["حسن|VF4", "ef", "نیکی کر"],
    ["خشي|VF1", "l", "ڈر", "ia", "خَشْيَةٌ"],
    ["زيد|VF1", "e", "بڑھا", "ai", "زِيَادَةٌ"],
    ["خوف|VF2", "e", "ڈرا"],
    ["خوف|VF1", "l", "ڈر", "aa", "خَوْفٌ"],
    ["ملو|VF4", "ef", "ڈھیل دے"],
    ["زيد|VF8", "l", "بڑھ"],
    ["وذر|VF1", "e", "چھوڑ", "aa", "وَذْرٌ"],
    ["ميز|VF1", "e", "الگ کر", "ai", "مَيْزٌ"],
    ["طلع|VF4", "e", "آگاہ کر"],
    ["جبي|VF8", "e", "چن"],
    ["بخل|VF1", "e", "بخل کر", "ia", "بُخْلٌ"],
    ["طوق|VF2", "e", "طوق پہنا"],
    ["قدم|VF2", "e", "آگے بھیج"],
    ["عهد|VF1", "e", "عہد لے", "ia", "عَهْدٌ"],
    ["كذب|VF2", "e", "جھٹلا"],
    ["فوز|VF1", "l", "کامیاب ہو", "au", "فَوْزٌ"],
    ["بلو|VF4", "e", "آزما"],
    ["أخذ|VF1", "e", "لے", "au", "أَخْذٌ", { amr: "خُذْ" }],
    ["نبذ|VF1", "e", "پھینک", "ai", "نَبْذٌ"],
    ["حمد|VF1", "ef", "تعریف کر", "ia", "حَمْدٌ"],
    ["نيل|VF1", "e", "پا", "aa", "نَيْلٌ"],
    ["حرم|VF2", "e", "حرام کر"],
    ["فري|VF8", "e", "گھڑ"],
    ["وضع|VF1", "e", "رکھ", "aa", "وَضْعٌ"],
    ["طوع|VF10", "ef", "طاقت رکھ"],
    ["صدد|VF1", "e", "روک", "au", "صَدٌّ"],
    ["بغي|VF1", "e", "چاہ", "ai", "بَغْيٌ"],
    ["بثث|VF1", "e", "پھیلا", "au", "بَثٌّ"],
    ["سأل|VF6", "el", "ایک دوسرے سے سوال کر"],
    ["صلي|VF1", "l", "آگ میں داخل ہو", "ia", "صِلِيٌّ"],
    ["وصي|VF4", "ef", "وصیت کر"],
    ["ترك|VF1", "e", "چھوڑ", "au", "تَرْكٌ"],
    ["ورث|VF1", "lp", "وارث ہو", "ii", "إِرْثٌ", { pu: "وارث بنا" }],
    ["دري|VF1", "e", "جان", "ai", "دِرَايَةٌ"],
    ["عدو|VF5", "el", "تجاوز کر"],
    ["شهد|VF10", "e", "گواہ بنا"],
    ["شهد|VF1", "ef", "گواہی دے", "ia", "شَهَادَةٌ"],
    ["مسك|VF4", "e", "روک رکھ"],
    ["صلح|VF4", "ef", "اصلاح کر"],
    ["عرض|VF4", "el", "منہ پھیر"],
    ["حضر|VF1", "l", "حاضر ہو", "au", "حُضُورٌ"],
    ["عتد|VF4", "e", "تیار کر"],
    ["حلل|VF1", "l", "حلال ہو", "ai", "حِلٌّ"],
    ["عضل|VF1", "e", "روک", "au", "عَضْلٌ"],
    ["ذهب|VF1", "l", "جا", "aa", "ذَهَابٌ"],
    ["عشر|VF3", "e", "گزر بسر کر"],
    ["كره|VF1", "e", "ناپسند کر", "ia", "كُرْهٌ"],
    ["بدل|VF5", "e", "بدل"],
    ["فضو|VF4", "l", "پہنچ"],
    ["نكح|VF1", "e", "نکاح کر", "ai", "نِكَاحٌ"],
    ["سلف|VF1", "l", "گزر", "au", "سَلَفٌ"],
    ["رضع|VF4", "e", "دودھ پلا"],
    ["قسط|VF4", "el", "انصاف کر"],
    ["طيب|VF1", "l", "پسند آ", "ai", "طِيبٌ"],
    ["عدل|VF1", "e", "انصاف کر", "ai", "عَدْلٌ"],
    ["ملك|VF1", "l", "مالک ہو", "ai", "مُلْكٌ"],
    ["عول|VF1", "l", "ایک طرف جھک", "au", "عَوْلٌ"],
    ["كسو|VF1", "e", "لباس پہنا", "au", "كِسْوَةٌ"],
    ["بلغ|VF1", "l", "پہنچ", "au", "بُلُوغٌ"],
    ["أنس|VF4", "e", "محسوس کر"],
    ["كبر|VF1", "l", "بڑا ہو", "ia", "كِبَرٌ"],
    ["عفف|VF10", "el", "پرہیز کر"],
    ["شهد|VF4", "e", "گواہ بنا"],
    ["قلل|VF1", "l", "کم ہو", "ai", "قِلَّةٌ"],
    ["كثر|VF1", "l", "زیادہ ہو", "uu", "كَثْرَةٌ"],
    // Para 1
    ["أبي|VF1", "e", "انکار کر", "aa", "إِبَاءٌ"],
    ["أيد|VF2", "ef", "قوت دے"],
    ["بدل|VF10", "e", "بدلے میں لے"],
    ["بدل|VF2", "e", "بدل ڈال"],
    ["بشر|VF2", "ef", "خوش خبری دے"],
    ["بصر|VF4", "e", "دیکھ"],
    ["بين|VF5", "l", "واضح ہو"],
    ["تبع|VF1", "ef", "پیروی کر", "ia", "تَبَعٌ"],
    ["تمم|VF4", "e", "پورا کر"],
    ["ثور|VF4", "e", "اٹھا"],
    ["حجج|VF3", "e", "جھگڑا کر"],
    ["حدث|VF2", "e", "بیان کر"],
    ["حرف|VF2", "ef", "تحریف کر"],
    ["حكم|VF1", "e", "فیصلہ کر", "au", "حُكْمٌ"],
    ["حوط|VF4", "e", "گھیر"],
    ["حيي|VF10", "e", "زندہ چھوڑ"],
    ["ختم|VF1", "ef", "مہر لگا", "ai", "خَتْمٌ"],
    ["خدع|VF1", "e", "دھوکا دے", "aa", "خَدْعٌ"],
    ["خدع|VF3", "e", "دھوکا دے"],
    ["خرج|VF1", "l", "نکل", "au", "خُرُوجٌ"],
    ["خصص|VF8", "e", "خاص کر"],
    ["خطف|VF1", "e", "اچک", "ia", "خَطْفٌ"],
    ["خفف|VF2", "e", "ہلکا کر"],
    ["ذبح|VF1", "e", "ذبح کر", "aa", "ذَبْحٌ"],
    ["ذبح|VF2", "e", "ذبح کر"],
    ["ربح|VF1", "e", "فائدہ دے", "ia", "رِبْحٌ"],
    ["رسل|VF4", "e", "بھیج"],
    ["رضو|VF1", "l", "راضی ہو", "ia", "رِضًا"],
    ["رعي|VF3", "ef", "رعایت کر"],
    ["رغب|VF1", "ef", "رغبت کر", "ia", "رَغْبَةٌ"],
    ["رفع|VF1", "e", "اٹھا", "aa", "رَفْعٌ"],
    ["ركع|VF1", "el", "رکوع کر", "aa", "رُكُوعٌ"],
    ["رهب|VF1", "l", "ڈر", "ia", "رَهْبَةٌ"],
    ["زلل|VF4", "e", "پھسلا"],
    ["سأل|VF1", "e", "پوچھ", "aa", "سُؤَالٌ"],
    ["سبح|VF2", "ef", "تسبیح کر"],
    ["سرر|VF1", "e", "خوش کر", "au", "سُرُورٌ"],
    ["سرر|VF4", "e", "چھپا"],
    ["سعي|VF1", "ef", "کوشش کر", "aa", "سَعْيٌ"],
    ["سفك|VF1", "e", "بہا", "ai", "سَفْكٌ"],
    ["سفه|VF1", "e", "بے وقوف بنا", "ia", "سَفَهٌ"],
    ["سقي|VF1", "e", "پانی پلا", "ai", "سَقْيٌ"],
    ["سقي|VF10", "e", "پانی مانگ"],
    ["سكن|VF1", "l", "رہ", "au", "سُكُونٌ"],
    ["سلم|VF4", "l", "فرماں بردار ہو"],
    ["سوم|VF1", "ef", "تکلیف دے", "au", "سَوْمٌ"],
    ["سوي|VF2", "e", "درست کر"],
    ["سوي|VF8", "l", "برابر ہو"],
    ["شبه|VF6", "l", "ملتا جلتا ہو"],
    ["شرب|VF1", "e", "پی", "ia", "شُرْبٌ"],
    ["شرب|VF4", "e", "پلا"],
    ["شري|VF1", "e", "بیچ", "ai", "شِرَاءٌ"],
    ["شعر|VF1", "e", "شعور رکھ", "au", "شُعُورٌ"],
    ["شقق|VF5", "l", "پھٹ"],
    ["صفح|VF1", "e", "درگزر کر", "aa", "صَفْحٌ"],
    ["صفو|VF8", "e", "چن"],
    ["ضرر|VF8", "e", "مجبور کر"],
    ["ضلل|VF1", "l", "گمراہ ہو", "ai", "ضَلَالٌ"],
    ["ضلل|VF4", "e", "گمراہ کر"],
    ["ضوأ|VF4", "e", "روشن کر"],
    ["طمع|VF1", "ef", "امید رکھ", "ia", "طَمَعٌ"],
    ["طهر|VF2", "e", "پاک کر"],
    ["ظلل|VF2", "e", "سایہ کر"],
    ["ظلم|VF4", "e", "اندھیرا کر"],
    ["ظهر|VF6", "ef", "ایک دوسرے کی مدد کر"],
    ["عبد|VF1", "ef", "عبادت کر", "au", "عِبَادَةٌ"],
    ["عثو|VF1", "e", "فساد پھیلا", "ia", "عُثُوٌّ"],
    ["عرض|VF1", "e", "پیش کر", "ai", "عَرْضٌ"],
    ["عرف|VF1", "e", "پہچان", "ai", "مَعْرِفَةٌ"],
    ["علم|VF5", "e", "سیکھ"],
    ["علن|VF4", "e", "ظاہر کر"],
    ["عمر|VF2", "ef", "عمر دے"],
    ["عمه|VF1", "l", "بھٹک", "ia", "عَمَهٌ"],
    ["عهد|VF3", "e", "عہد کر"],
    ["عوذ|VF1", "ef", "پناہ مانگ", "au", "عَوْذٌ"],
    ["عون|VF10", "ef", "مدد مانگ"],
    ["غرق|VF4", "e", "غرق کر"],
    ["فتح|VF1", "e", "کھول", "aa", "فَتْحٌ"],
    ["فتح|VF10", "ef", "فتح مانگ"],
    ["فجر|VF5", "l", "پھوٹ نکل"],
    ["فجر|VF7", "l", "پھوٹ پڑ"],
    ["فدي|VF3", "e", "فدیہ دے کر چھڑا"],
    ["فرق|VF1", "e", "پھاڑ", "au", "فَرْقٌ"],
    ["فرق|VF2", "ef", "جدائی ڈال"],
    ["فسد|VF4", "e", "فساد کر"],
    ["فسق|VF1", "ef", "نافرمانی کر", "au", "فِسْقٌ"],
    ["فضل|VF2", "ef", "فضیلت دے"],
    ["قبل|VF1", "e", "قبول کر", "ia", "قَبُولٌ"],
    ["قبل|VF5", "e", "قبول کر"],
    ["قدس|VF2", "ef", "پاکی بیان کر"],
    ["قرب|VF1", "l", "قریب جا", "ia", "قُرْبٌ"],
    ["قرر|VF4", "e", "اقرار کر"],
    ["قسو|VF1", "l", "سخت ہو", "au", "قَسْوَةٌ"],
    ["قضي|VF1", "e", "فیصلہ کر", "ai", "قَضَاءٌ"],
    ["قفو|VF2", "e", "پیچھے بھیج"],
    ["قوم|VF1", "l", "کھڑا ہو", "au", "قِيَامٌ"],
    ["قوم|VF4", "e", "قائم کر"],
    ["كبر|VF10", "e", "تکبر کر"],
    ["كذب|VF1", "e", "جھوٹ بول", "ai", "كَذِبٌ"],
    ["كلم|VF2", "e", "کلام کر"],
    ["كود|VF1", "l", "قریب ہو", "aa", "كَوْدٌ"],
    ["لبس|VF1", "e", "گڈ مڈ کر", "ai", "لَبْسٌ"],
    ["لعن|VF1", "ef", "لعنت کر", "aa", "لَعْنٌ"],
    ["لقي|VF5", "e", "حاصل کر"],
    ["متع|VF2", "e", "فائدہ اٹھانے دے"],
    ["مدد|VF1", "e", "پھیلا", "au", "مَدٌّ"],
    ["مشي|VF1", "l", "چل", "ai", "مَشْيٌ"],
    ["منع|VF1", "e", "روک", "aa", "مَنْعٌ"],
    ["نبأ|VF4", "ef", "خبر دے"],
    ["نبت|VF4", "e", "اگا"],
    ["نجو|VF2", "ef", "نجات دے"],
    ["نجو|VF4", "ef", "نجات دے"],
    ["نذر|VF4", "e", "ڈرا"],
    ["نسخ|VF1", "e", "منسوخ کر", "aa", "نَسْخٌ"],
    ["نسي|VF1", "x", "بھول", "ia", "نِسْيَانٌ"],
    ["نسي|VF4", "e", "بھلا دے"],
    ["نعم|VF4", "e", "انعام کر"],
    ["نفع|VF1", "e", "نفع دے", "aa", "نَفْعٌ"],
    ["نقض|VF1", "e", "توڑ", "au", "نَقْضٌ"],
    ["هبط|VF1", "l", "اتر", "ai", "هُبُوطٌ"],
    ["هزأ|VF10", "e", "مذاق اڑا"],
    ["هود|VF1", "l", "یہودی بن", "au", "هَوْدٌ"],
    ["هوي|VF1", "e", "چاہ", "ia", "هَوًى"],
    ["وجد|VF1", "e", "پا", "ai", "وُجُودٌ"],
    ["وصل|VF1", "e", "جوڑ", "ai", "وَصْلٌ"],
    ["وصي|VF2", "ef", "وصیت کر"],
    ["وعد|VF3", "e", "وعدہ کر"],
    ["وفي|VF4", "e", "پورا کر"],
    ["وقد|VF10", "ef", "آگ جلا"],
    ["يقن|VF4", "e", "یقین رکھ"],
    // Para 2
    ["أخذ|VF3", "e", "مواخذہ کر"],
    ["أخر|VF5", "efl", "دیر کر"],
    ["ألو|VF4", "efl", "قسم کھا"],
    ["أمن|VF1", "l", "امن میں ہو", "ia", "أَمْنٌ"],
    ["برأ|VF5", "efl", "بیزاری ظاہر کر"],
    ["برر|VF1", "efl", "نیکی کر", "ia", "بِرٌّ"],
    ["بسط|VF1", "e", "پھیلا", "au", "بَسْطٌ"],
    ["بشر|VF3", "ef", "مباشرت کر"],
    ["بغي|VF8", "e", "تلاش کر"],
    ["بلو|VF1", "e", "آزما", "au", "بَلَاءٌ"],
    ["جوب|VF4", "e", "جواب دے"],
    ["جوز|VF3", "e", "پار کر"],
    ["حبط|VF1", "l", "ضائع ہو", "ia", "حُبُوطٌ"],
    ["حجج|VF1", "e", "حج کر", "au", "حَجٌّ"],
    ["حذر|VF1", "l", "ڈر", "ia", "حَذَرٌ"],
    ["حصر|VF4", "e", "گھیر"],
    ["حفظ|VF3", "ef", "حفاظت کر"],
    ["حلق|VF1", "e", "منڈا", "ai", "حَلْقٌ"],
    ["حلل|VF4", "e", "حلال کر"],
    ["حمل|VF1", "e", "اٹھا", "ai", "حَمْلٌ"],
    ["خلط|VF3", "e", "ملا جلا رکھ"],
    ["خون|VF8", "efl", "خیانت کر"],
    ["دلو|VF4", "e", "پہنچا"],
    ["ذكر|VF5", "ef", "نصیحت حاصل کر"],
    ["ربص|VF5", "el", "انتظار کر"],
    ["رجع|VF6", "el", "آپس میں رجوع کر"],
    ["رجو|VF1", "ef", "امید رکھ", "au", "رَجَاءٌ"],
    ["ردد|VF8", "lx", "پھر"],
    ["رشد|VF1", "efl", "راہ پا", "au", "رُشْدٌ"],
    ["رضع|VF10", "e", "دودھ پلوا"],
    ["رضو|VF6", "l", "باہم راضی ہو"],
    ["زلزل|VF1", "e", "ہلا", "", "زِلْزَالٌ"],
    ["زلل|VF1", "lx", "پھسل", "ai", "زَلَلٌ"],
    ["زود|VF5", "e", "زاد راہ لے"],
    ["زيل|VF1", "l", "باز آ", "aa", "زَوَالٌ"],
    ["زين|VF2", "e", "خوشنما بنا"],
    ["سبق|VF8", "l", "آگے بڑھ"],
    ["سخر|VF1", "e", "مذاق اڑا", "ia", "سُخْرِيَةٌ"],
    ["سرح|VF2", "e", "رخصت کر"],
    ["سلم|VF2", "e", "سپرد کر"],
    ["صوم|VF1", "el", "روزہ رکھ", "au", "صَوْمٌ"],
    ["ضرر|VF3", "e", "نقصان پہنچا"],
    ["ضعف|VF3", "e", "کئی گنا بڑھا"],
    ["طعم|VF1", "e", "چکھ", "ia", "طَعْمٌ"],
    ["طلق|VF2", "ef", "طلاق دے"],
    ["طهر|VF1", "l", "پاک ہو", "au", "طُهْرٌ"],
    ["طهر|VF5", "efl", "پاکیزگی حاصل کر"],
    ["طوع|VF5", "efl", "خوشی سے نیکی کر"],
    ["طوف|VF5", "el", "طواف کر"],
    ["طوق|VF4", "ef", "طاقت رکھ"],
    ["عجب|VF4", "l", "پسند آ"],
    ["عجل|VF5", "efl", "جلدی کر"],
    ["عرض|VF2", "el", "اشارہ کر"],
    ["عزل|VF8", "l", "الگ رہ"],
    ["عمر|VF8", "el", "عمرہ کر"],
    ["عنت|VF4", "e", "مشکل میں ڈال"],
    ["غرف|VF8", "e", "چلو بھر"],
    ["غلب|VF1", "l", "غالب آ", "ai", "غَلَبَةٌ"],
    ["فدي|VF8", "el", "فدیہ دے"],
    ["فرض|VF1", "e", "فرض کر", "ai", "فَرْضٌ"],
    ["فرغ|VF4", "e", "انڈیل"],
    ["فسد|VF1", "lx", "بگڑ", "au", "فَسَادٌ"],
    ["فصل|VF1", "l", "جدا ہو", "ai", "فَصْلٌ"],
    ["فيأ|VF1", "el", "رجوع کر", "ai", "فَيْءٌ"],
    ["فيض|VF4", "l", "پلٹ"],
    ["قبض|VF1", "e", "تنگ کر", "ai", "قَبْضٌ"],
    ["قرض|VF4", "e", "قرض دے"],
    ["قطع|VF5", "lx", "کٹ"],
    ["كبر|VF2", "ef", "بڑائی بیان کر"],
    ["كلف|VF2", "ef", "تکلیف دے"],
    ["كمل|VF4", "e", "مکمل کر"],
    ["كنن|VF4", "e", "چھپا"],
    ["لفو|VF4", "e", "پا"],
    ["متع|VF5", "el", "فائدہ اٹھا"],
    ["نظر|VF4", "ef", "مہلت دے"],
    ["نعق|VF1", "e", "پکار", "ai", "نَعِيقٌ"],
    ["نكح|VF4", "e", "نکاح میں دے"],
    ["نهي|VF8", "l", "باز آ"],
    ["هزم|VF1", "ef", "شکست دے", "ai", "هَزْمٌ"],
    ["هلل|VF4", "e", "پکار"],
    ["وعظ|VF1", "ef", "نصیحت کر", "ai", "وَعْظٌ"],
    ["يسر|VF10", "l", "میسر آ"],
    // Para 3
    ["أدي|VF2", "e", "ادا کر"],
    ["أذن|VF1", "l", "خبردار ہو", "ia", "إِذْنٌ"],
    ["أمن|VF8", "e", "امین بنا"],
    ["أود|VF1", "e", "تھکا", "au", "أَوْدٌ"],
    ["بخس|VF1", "ef", "کمی کر", "aa", "بَخْسٌ"],
    ["برأ|VF4", "e", "اچھا کر"],
    ["بطل|VF4", "e", "ضائع کر"],
    ["بقي|VF1", "l", "باقی رہ", "ia", "بَقَاءٌ"],
    ["بهت|VF1", "e", "حیران کر", "aa", "بَهْتٌ"],
    ["بهل|VF8", "efl", "گڑگڑا کر دعا کر"],
    ["بيع|VF6", "el", "باہم خرید و فروخت کر"],
    ["تبع|VF4", "e", "پیچھے لگا"],
    ["حذر|VF2", "e", "ڈرا"],
    ["حرق|VF8", "lx", "جل"],
    ["حسب|VF3", "e", "حساب لے"],
    ["حسس|VF4", "e", "محسوس کر"],
    ["حمل|VF2", "e", "اٹھوا"],
    ["خبط|VF5", "e", "خبطی بنا"],
    ["خصم|VF8", "el", "جھگڑ"],
    ["خطأ|VF4", "efl", "خطا کر"],
    ["خفي|VF1", "l", "چھپا رہ", "ia", "خَفَاءٌ"],
    ["درس|VF1", "e", "پڑھ", "au", "دَرْسٌ"],
    ["دور|VF4", "e", "لین دین کر"],
    ["دوم|VF1", "l", "رہ", "au", "دَوَامٌ"],
    ["دين|VF6", "el", "باہم لین دین کر"],
    ["ذخر|VF8", "e", "ذخیرہ کر"],
    ["ذكر|VF2", "ef", "یاد دہانی کر"],
    ["ذلل|VF4", "e", "ذلیل کر"],
    ["ربو|VF4", "e", "بڑھا"],
    ["ريب|VF8", "l", "شک میں پڑ"],
    ["زيغ|VF4", "e", "ٹیڑھا کر"],
    ["سأم|VF1", "efl", "سستی کر", "ia", "سَأَمٌ"],
    ["سمو|VF2", "e", "نام رکھ"],
    ["سنه|VF5", "l", "خراب ہو"],
    ["شفع|VF1", "ef", "سفارش کر", "aa", "شَفَاعَةٌ"],
    ["صدق|VF5", "el", "صدقہ کر"],
    ["صلو|VF2", "efl", "نماز پڑھ"],
    ["صور|VF1", "e", "مائل کر", "au", "صَوْرٌ"],
    ["صور|VF2", "ef", "صورت بنا"],
    ["عزز|VF4", "ef", "عزت دے"],
    ["عود|VF1", "l", "لوٹ", "au", "عَوْدٌ"],
    ["عوذ|VF4", "ef", "پناہ میں دے"],
    ["غمض|VF4", "efl", "چشم پوشی کر"],
    ["قتل|VF8", "l", "آپس میں لڑ"],
    ["قدر|VF1", "ef", "قدرت رکھ", "ai", "قُدْرَةٌ"],
    ["قنت|VF1", "efl", "اطاعت کر", "au", "قُنُوتٌ"],
    ["كسب|VF8", "e", "کما"],
    ["كفل|VF1", "ef", "کفالت کر", "au", "كَفَالَةٌ"],
    ["كفل|VF2", "e", "کفیل بنا"],
    ["لبث|VF1", "l", "ٹھہر", "ia", "لُبْثٌ"],
    ["مرر|VF1", "l", "گزر", "au", "مَرٌّ"],
    ["مسك|VF10", "el", "مضبوط تھام"],
    ["مكر|VF1", "ef", "چال چل", "au", "مَكْرٌ"],
    ["ملل|VF4", "e", "املاء کر"],
    ["نبأ|VF2", "ef", "خبر دے"],
    ["نذر|VF1", "ef", "نذر مان", "au", "نَذْرٌ"],
    ["نزع|VF1", "e", "چھین", "ai", "نَزْعٌ"],
    ["نشز|VF4", "e", "اٹھا"],
    ["نفخ|VF1", "e", "پھونک", "au", "نَفْخٌ"],
    ["وحي|VF4", "ef", "وحی کر"],
    ["وسع|VF1", "l", "وسیع ہو", "ia", "سَعَةٌ"],
    ["ولج|VF4", "e", "داخل کر"],
    ["وهب|VF1", "e", "عطا کر", "aa", "هِبَةٌ"],
    ["يمم|VF5", "el", "ارادہ کر"],
    // Para 5
    ["أخر|VF2", "ef", "مہلت دے"],
    ["ألم|VF1", "efl", "تکلیف اٹھا", "ia", "أَلَمٌ"],
    ["بتك|VF2", "e", "کاٹ"],
    ["بطأ|VF2", "efl", "سستی کر"],
    ["بيت|VF2", "e", "رات کو مشورہ کر"],
    ["جدل|VF3", "e", "جھگڑا کر"],
    ["جنب|VF8", "l", "بچ"],
    ["حرص|VF1", "efl", "حرص کر", "ai", "حِرْصٌ"],
    ["حرض|VF2", "e", "ابھار"],
    ["حسد|VF1", "e", "حسد کر", "au", "حَسَدٌ"],
    ["حسن|VF1", "l", "اچھا ہو", "uu", "حُسْنٌ"],
    ["حصر|VF1", "l", "تنگ ہو", "ia", "حَصَرٌ"],
    ["حصن|VF4", "ef", "حفاظت کر"],
    ["حضر|VF4", "e", "حاضر کر"],
    ["حفظ|VF1", "ef", "حفاظت کر", "ia", "حِفْظٌ"],
    ["حكم|VF2", "e", "منصف بنا"],
    ["حكم|VF6", "l", "فیصلہ لے جا"],
    ["حلف|VF1", "efl", "قسم کھا", "ai", "حَلِفٌ"],
    ["حمل|VF8", "e", "اٹھا"],
    ["حوذ|VF10", "l", "غالب آ", null, null, { cls: "snd" }],
    ["حيي|VF2", "e", "سلام کر"],
    ["خسر|VF1", "e", "نقصان اٹھا", "ia", "خُسْرَانٌ"],
    ["خفي|VF10", "l", "چھپ"],
    ["خلص|VF4", "e", "خالص کر"],
    ["خوض|VF1", "l", "مشغول ہو", "au", "خَوْضٌ"],
    ["دبر|VF5", "e", "غور کر"],
    ["درك|VF4", "e", "پا"],
    ["ذهب|VF4", "", "لے جا", null, null, { pu: "دور کر" }],
    ["ذيع|VF4", "e", "پھیلا"],
    ["رأي|VF3", "el", "دکھاوا کر"],
    ["ركس|VF4", "e", "الٹا پھیر"],
    ["رمي|VF1", "e", "پھینک", "ai", "رَمْيٌ"],
    ["زعم|VF1", "e", "گمان کر", "au", "زَعْمٌ"],
    ["سلط|VF2", "e", "مسلط کر"],
    ["سوي|VF1", "l", "برابر ہو", "ia", "سَوَاءٌ"],
    ["شجر|VF1", "l", "اختلاف ہو", "au", "شَجْرٌ"],
    ["شقق|VF3", "ef", "مخالفت کر"],
    ["صلي|VF4", "e", "آگ میں جھونک"],
    ["طمس|VF1", "e", "مٹا", "ai", "طَمْسٌ"],
    ["طوع|VF1", "ef", "اطاعت کر", "au", "طَوْعٌ"],
    ["عقد|VF1", "e", "باندھ", "ai", "عَقْدٌ"],
    ["غسل|VF8", "el", "غسل کر"],
    ["غضب|VF1", "l", "غضب ناک ہو", "ia", "غَضَبٌ"],
    ["غفل|VF1", "l", "غافل ہو", "au", "غَفْلَةٌ"],
    ["غير|VF2", "e", "بدل"],
    ["فتن|VF1", "e", "فتنے میں ڈال", "ai", "فِتْنَةٌ"],
    ["فتي|VF10", "e", "فتوی پوچھ"],
    ["فتي|VF4", "e", "فتوی دے"],
    ["فقه|VF1", "e", "سمجھ", "ia", "فِقْهٌ"],
    ["قصر|VF1", "ef", "کمی کر", "au", "قَصْرٌ"],
    ["كفف|VF1", "e", "روک", "au", "كَفٌّ"],
    ["لمس|VF1", "e", "چھو", "ai", "لَمْسٌ"],
    ["متع|VF10", "el", "فائدہ اٹھا"],
    ["مسح|VF1", "e", "مسح کر", "aa", "مَسْحٌ"],
    ["مني|VF2", "ef", "امید دلا"],
    ["ميل|VF1", "l", "جھک", "ai", "مَيْلٌ"],
    ["نبط|VF10", "e", "استنباط کر"],
    ["نضج|VF1", "lx", "پک", "ia", "نُضْجٌ"],
    ["نفر|VF1", "l", "نکل", "ai", "نَفْرٌ"],
    ["هجر|VF1", "e", "چھوڑ", "au", "هَجْرٌ"],
    ["وفق|VF2", "ef", "موافقت پیدا کر"],
    ["وقع|VF1", "l", "واقع ہو", "aa", "وُقُوعٌ"],
    // Para 6
    ["أسو|VF1", "el", "افسوس کر", "ia", "أَسًى"],
    ["أفك|VF1", "e", "پھیر", "ai", "إِفْكٌ"],
    ["بحث|VF1", "e", "کھود", "aa", "بَحْثٌ"],
    ["بلغ|VF2", "e", "پہنچا"],
    ["تيه|VF1", "l", "سرگرداں پھر", "ai", "تِيهٌ"],
    ["جرم|VF1", "e", "آمادہ کر", "ai", "جُرْمٌ"],
    ["حرب|VF3", "ef", "جنگ کر"],
    ["حفظ|VF10", "e", "نگران ٹھہرا"],
    ["ذكو|VF2", "e", "ذبح کر"],
    ["سخط|VF1", "l", "ناراض ہو", "ia", "سَخَطٌ"],
    ["شبه|VF2", "e", "شبہ میں ڈال"],
    ["صلب|VF1", "e", "سولی چڑھا", "ai", "صَلْبٌ"],
    ["صلب|VF2", "e", "سولی چڑھا"],
    ["صمم|VF1", "l", "بہرا ہو", "ia", "صَمَمٌ"],
    ["صنع|VF1", "e", "بنا", "aa", "صُنْعٌ"],
    ["صيد|VF8", "e", "شکار کر"],
    ["طبع|VF1", "ef", "مہر لگا", "aa", "طَبْعٌ"],
    ["طفأ|VF4", "e", "بجھا"],
    ["طلع|VF8", "ef", "اطلاع پا"],
    ["طوع|VF2", "e", "آسان کر"],
    ["عجز|VF1", "l", "عاجز ہو", "ai", "عَجْزٌ"],
    ["عدو|VF1", "ef", "زیادتی کر", "au", "عُدْوَانٌ"],
    ["عزر|VF2", "ef", "مدد کر"],
    ["عصم|VF1", "e", "بچا", "ai", "عِصْمَةٌ"],
    ["عمي|VF1", "l", "اندھا ہو", "ia", "عَمًى"],
    ["عون|VF6", "el", "تعاون کر"],
    ["غرو|VF4", "e", "ڈال"],
    ["غسل|VF1", "e", "دھو", "ai", "غَسْلٌ"],
    ["غلو|VF1", "l", "حد سے بڑھ", "au", "غُلُوٌّ"],
    ["قتل|VF2", "e", "قتل کر"],
    ["قرب|VF2", "e", "پیش کر"],
    ["قسم|VF10", "ef", "قسمت معلوم کر"],
    ["قسم|VF4", "efl", "قسم کھا"],
    ["قصص|VF1", "e", "بیان کر", "au", "قَصَصٌ"],
    ["قطع|VF2", "e", "ٹکڑے کر"],
    ["نفي|VF1", "e", "نکال", "ai", "نَفْيٌ"],
    ["نقم|VF1", "l", "ناراض ہو", "ai", "نِقْمَةٌ"],
    ["نكف|VF10", "e", "عار سمجھ"],
    ["نهي|VF6", "el", "ایک دوسرے کو روک"],
    ["هلك|VF1", "l", "ہلاک ہو", "ai", "هَلَاكٌ"],
    ["وثق|VF3", "e", "عہد باندھ"],
    ["وري|VF3", "e", "چھپا"],
    ["وقد|VF4", "e", "بھڑکا"],
    ["يأس|VF1", "l", "مایوس ہو", "ia", "يَأْسٌ"],
    // Para 7
    ["أفل|VF1", "lx", "چھپ", "ai", "أُفُولٌ"],
    ["بسل|VF4", "e", "ہلاک کر"],
    ["بين|VF10", "l", "ظاہر ہو"],
    ["ثمر|VF4", "l", "پھل لا"],
    ["جحد|VF1", "e", "انکار کر", "aa", "جُحُودٌ"],
    ["جرح|VF1", "e", "کما", "aa", "جَرْحٌ"],
    ["جنن|VF1", "l", "اندھیرا چھا", "au", "جُنُونٌ"],
    ["حبس|VF1", "e", "روک", "ai", "حَبْسٌ"],
    ["حقق|VF10", "l", "حق دار ہو"],
    ["حيق|VF1", "e", "گھیر", "ai", "حَيْقٌ"],
    ["خرق|VF1", "e", "پھاڑ", "ai", "خَرْقٌ"],
    ["خول|VF2", "e", "عطا کر"],
    ["ذوق|VF4", "e", "چکھا"],
    ["سبب|VF1", "ef", "گالی دے", "au", "سَبٌّ"],
    ["سقط|VF1", "l", "گر", "au", "سُقُوطٌ"],
    ["سمع|VF8", "e", "کان لگا کر سن"],
    ["شعر|VF4", "e", "سمجھا"],
    ["صدف|VF1", "el", "منہ موڑ", "ai", "صُدُوفٌ"],
    ["صرف|VF2", "e", "پھیر پھیر کر بیان کر"],
    ["ضرع|VF1", "efl", "عاجزی کر", "aa", "ضَرَاعَةٌ"],
    ["ضرع|VF5", "l", "گڑگڑا"],
    ["طرد|VF1", "e", "دھتکار", "au", "طَرْدٌ"],
    ["طعم|VF4", "e", "کھلا"],
    ["طير|VF1", "l", "اڑ", "ai", "طَيَرَانٌ"],
    ["عثر|VF1", "lp", "خبر ہو", "au", "عُثُورٌ", { pu: "مطلع کر" }],
    ["عجل|VF10", "ef", "جلدی مچا"],
    ["عقد|VF2", "ef", "گرہ باندھ"],
    ["علو|VF6", "l", "بلند ہو"],
    ["فرط|VF2", "ef", "کوتاہی کر"],
    ["فصل|VF2", "e", "کھول کر بیان کر"],
    ["فطر|VF1", "e", "پیدا کر", "aa", "فَطْرٌ"],
    ["فيض|VF1", "l", "بہ", "ai", "فَيْضٌ"],
    ["قدو|VF8", "ef", "پیروی کر"],
    ["قلب|VF2", "e", "الٹ پلٹ کر"],
    ["كشف|VF1", "e", "کھول", "ai", "كَشْفٌ"],
    ["لعب|VF1", "el", "کھیل", "ia", "لَعِبٌ"],
    ["مري|VF8", "el", "شک کر"],
    ["مكن|VF2", "ef", "قدرت دے"],
    ["نأي|VF1", "l", "دور رہ", "aa", "نَأْيٌ"],
    ["نشأ|VF4", "e", "پیدا کر"],
    ["نقم|VF8", "e", "انتقام لے"],
    ["هوي|VF10", "e", "بہکا"],
    ["وجه|VF2", "e", "رخ پھیر"],
    ["وزر|VF1", "e", "بوجھ اٹھا", "ai", "وِزْرٌ"],
    ["وصف|VF1", "e", "بیان کر", "ai", "وَصْفٌ"],
    ["وقع|VF4", "e", "ڈال"],
    ["وقف|VF1", "e", "کھڑا کر", "ai", "وُقُوفٌ", { pu: "کھڑا کر" }],
    ["وكل|VF2", "e", "مقرر کر"],
    // Para 8
    ["أجل|VF2", "e", "مقرر کر"],
    ["أخر|VF10", "efl", "دیر کر"],
    ["أذن|VF2", "e", "اعلان کر"],
    ["بدأ|VF1", "e", "شروع کر", "aa", "بَدْءٌ"],
    ["برك|VF6", "l", "بابرکت ہو"],
    ["بطن|VF1", "l", "چھپا ہو", "au", "بُطُونٌ"],
    ["بلغ|VF4", "e", "پہنچا"],
    ["تمم|VF1", "l", "پورا ہو", "ai", "تَمَامٌ"],
    ["ثقل|VF1", "l", "بھاری ہو", "uu", "ثِقَلٌ"],
    ["جرم|VF4", "e", "جرم کر"],
    ["جهل|VF1", "ef", "جہالت کر", "ia", "جَهْلٌ"],
    ["حقق|VF1", "l", "ثابت ہو", "ai", "حَقٌّ"],
    ["حيي|VF1", "l", "زندہ رہ", "ia", "حَيَاةٌ"],
    ["خبث|VF1", "l", "خراب ہو", "uu", "خُبْثٌ"],
    ["خرص|VF1", "e", "اٹکل لگا", "au", "خَرْصٌ"],
    ["خصف|VF1", "e", "چپکا", "ai", "خَصْفٌ"],
    ["خفف|VF1", "l", "ہلکا ہو", "ai", "خِفَّةٌ"],
    ["خلط|VF8", "lx", "مل"],
    ["خلف|VF10", "e", "جانشین بنا"],
    ["درك|VF6", "l", "جمع ہو"],
    ["دلل|VF1", "ef", "رہنمائی کر", "au", "دَلَالَةٌ"],
    ["ذرأ|VF1", "e", "پیدا کر", "aa", "ذَرْءٌ"],
    ["ردي|VF4", "e", "ہلاک کر"],
    ["سبق|VF1", "l", "آگے نکل", "ai", "سَبْقٌ"],
    ["سرف|VF4", "e", "اسراف کر"],
    ["سوق|VF1", "e", "ہانک", "au", "سَوْقٌ"],
    ["شرح|VF1", "e", "کھول", "aa", "شَرْحٌ"],
    ["شمل|VF8", "l", "مشتمل ہو"],
    ["صعد|VF5", "l", "چڑھ"],
    ["صغو|VF1", "l", "مائل ہو", "aa", "صَغْوٌ"],
    ["ضعف|VF10", "e", "کمزور سمجھ"],
    ["طفق|VF1", "l", "لگ", "ia", "طَفَقٌ"],
    ["طلب|VF1", "e", "تلاش کر", "au", "طَلَبٌ"],
    ["ظهر|VF1", "l", "ظاہر ہو", "aa", "ظُهُورٌ"],
    ["عتو|VF1", "efl", "سرکشی کر", "au", "عُتُوٌّ"],
    ["عجب|VF1", "el", "تعجب کر", "ia", "عَجَبٌ"],
    ["عقر|VF1", "ef", "کونچیں کاٹ", "ai", "عَقْرٌ"],
    ["غشو|VF4", "e", "ڈھانپ"],
    ["غني|VF1", "l", "بس", "ia", "غِنًى"],
    ["غوي|VF4", "e", "گمراہ کر"],
    ["فتح|VF2", "e", "کھول"],
    ["قدم|VF10", "l", "آگے بڑھ"],
    ["قرف|VF8", "e", "کما"],
    ["قسم|VF3", "e", "قسم کھا کر کہ"],
    ["قلل|VF4", "e", "اٹھا"],
    ["كبر|VF5", "e", "تکبر کر"],
    ["كثر|VF10", "e", "زیادہ حاصل کر"],
    ["كثر|VF2", "e", "بہت کر"],
    ["مطر|VF4", "e", "برسا"],
    ["ملأ|VF1", "e", "بھر", "aa", "مَلْءٌ"],
    ["نحت|VF1", "e", "تراش", "ai", "نَحْتٌ"],
    ["نصح|VF1", "ef", "خیر خواہی کر", "aa", "نُصْحٌ"],
    ["نظر|VF8", "e", "انتظار کر"],
    ["ورث|VF4", "e", "وارث بنا"],
    ["وسوس|VF1", "e", "وسوسہ ڈال"],
    ["وعد|VF4", "e", "ڈرا"],
    ["ولج|VF1", "l", "داخل ہو", "ai", "وُلُوجٌ"],
    // Para 9
    ["أذن|VF5", "ef", "خبر دے"],
    ["أوي|VF4", "ef", "پناہ دے"],
    ["بجس|VF7", "l", "پھوٹ نکل"],
    ["برك|VF3", "ef", "برکت دے"],
    ["بطش|VF1", "e", "پکڑ", "ai", "بَطْشٌ"],
    ["بطل|VF1", "l", "باطل ہو", "au", "بُطْلَانٌ"],
    ["ثبت|VF4", "e", "قید کر"],
    ["ثقل|VF4", "l", "بوجھل ہو"],
    ["جرر|VF1", "e", "کھینچ", "au", "جَرٌّ"],
    ["جلو|VF1", "l", "روشن ہو", "au", "جَلَاءٌ"],
    ["جلو|VF2", "e", "ظاہر کر"],
    ["حقق|VF4", "e", "ثابت کر"],
    ["حول|VF1", "l", "حائل ہو", "au", "حَوْلٌ"],
    ["خرر|VF1", "l", "گر پڑ", "ai", "خُرُورٌ"],
    ["خطف|VF5", "e", "اچک"],
    ["خلد|VF4", "l", "جھک"],
    ["خلف|VF1", "ef", "جانشینی کر", "au", "خِلَافَةٌ"],
    ["خون|VF1", "ef", "خیانت کر", "au", "خِيَانَةٌ"],
    ["خير|VF8", "e", "چن"],
    ["درج|VF10", "e", "آہستہ آہستہ پکڑ"],
    ["دمر|VF2", "e", "برباد کر"],
    ["ربط|VF1", "e", "باندھ", "ai", "رَبْطٌ"],
    ["رجو|VF4", "ef", "ڈھیل دے"],
    ["ركم|VF1", "e", "جمع کر", "au", "رَكْمٌ"],
    ["رهب|VF10", "e", "خوف زدہ کر"],
    ["سبت|VF1", "el", "سبت منا", "ai", "سَبْتٌ"],
    ["سحر|VF1", "e", "جادو کر", "aa", "سِحْرٌ"],
    ["سكت|VF1", "l", "چپ ہو", "au", "سُكُوتٌ"],
    ["سلخ|VF7", "l", "نکل بھاگ"],
    ["سمع|VF4", "e", "سنا"],
    ["شمت|VF4", "e", "خوش کر"],
    ["طير|VF5", "e", "برا شگون لے"],
    ["عجل|VF1", "ef", "جلدی کر", "ia", "عَجَلَةٌ"],
    ["عرش|VF1", "e", "چھت پر چڑھا", "ai", "عَرْشٌ"],
    ["عكف|VF1", "l", "جم کر بیٹھ", "au", "عُكُوفٌ"],
    ["عوذ|VF10", "ef", "پناہ مانگ"],
    ["غشو|VF2", "e", "طاری کر"],
    ["غشو|VF5", "e", "ڈھانپ"],
    ["غوث|VF10", "ef", "فریاد کر"],
    ["فوق|VF4", "l", "ہوش میں آ"],
    ["قرأ|VF1", "e", "پڑھ", "aa", "قِرَاءَةٌ"],
    ["قرب|VF8", "l", "قریب آ"],
    ["قرر|VF10", "l", "قائم رہ"],
    ["قصر|VF4", "ef", "کمی کر"],
    ["كيد|VF1", "ef", "چال چل", "ai", "كَيْدٌ"],
    ["لحد|VF4", "ef", "کج روی کر"],
    ["لقف|VF1", "e", "نگل", "aa", "لَقْفٌ"],
    ["لهث|VF1", "e", "زبان نکال", "aa", "لَهْثٌ"],
    ["مسك|VF2", "e", "مضبوط پکڑ"],
    ["نتق|VF1", "e", "اٹھا", "au", "نَتْقٌ"],
    ["نزغ|VF1", "e", "وسوسہ ڈال", "aa", "نَزْغٌ"],
    ["نصت|VF4", "l", "خاموش رہ"],
    ["نكث|VF1", "e", "توڑ", "au", "نَكْثٌ"],
    ["وجل|VF1", "l", "ڈر", "ia", "وَجَلٌ", { kw: 1 }],
    // Para 10
    ["أذن|VF10", "ef", "اجازت مانگ"],
    ["بعد|VF1", "l", "دور ہو", "uu", "بُعْدٌ"],
    ["بكي|VF1", "l", "رو", "ai", "بُكَاءٌ"],
    ["ثبت|VF1", "l", "جما رہ", "au", "ثَبَاتٌ"],
    ["ثبط|VF2", "e", "روک"],
    ["ثخن|VF4", "ef", "خوب خون ریزی کر"],
    ["ثقل|VF6", "lx", "بوجھ سے جھک"],
    ["جمح|VF1", "l", "سرپٹ دوڑ", "aa", "جِمَاحٌ"],
    ["جنح|VF1", "l", "مائل ہو", "aa", "جُنُوحٌ"],
    ["جور|VF10", "ef", "پناہ مانگ"],
    ["جور|VF4", "ef", "پناہ دے"],
    ["حبب|VF10", "ef", "ترجیح دے"],
    ["حدد|VF3", "ef", "مخالفت کر"],
    ["حمي|VF1", "e", "تپا", "ai", "حَمْيٌ"],
    ["خلو|VF2", "e", "چھوڑ"],
    ["دين|VF1", "e", "دین اختیار کر", "ai", "دِينٌ"],
    ["رأي|VF6", "l", "آمنے سامنے ہو"],
    ["رحب|VF1", "l", "کشادہ ہو", "uu", "رُحْبٌ"],
    ["ردد|VF5", "l", "تذبذب میں رہ"],
    ["رضو|VF4", "e", "راضی کر"],
    ["رقب|VF1", "e", "لحاظ کر", "au", "رُقُوبٌ"],
    ["رهب|VF4", "e", "ڈرا"],
    ["زهق|VF1", "lx", "نکل", "aa", "زُهُوقٌ"],
    ["سيح|VF1", "l", "چل پھر", "ai", "سِيَاحَةٌ"],
    ["شرد|VF2", "e", "بھگا"],
    ["شفي|VF1", "ef", "شفا دے", "ai", "شِفَاءٌ"],
    ["ضحك|VF1", "l", "ہنس", "ia", "ضَحِكٌ"],
    ["ضهأ|VF3", "ef", "مشابہت کر"],
    ["ضيق|VF1", "l", "تنگ ہو", "ai", "ضِيقٌ"],
    ["طعن|VF1", "e", "طعنہ دے", "au", "طَعْنٌ"],
    ["ظهر|VF3", "ef", "پشت پناہی کر"],
    ["ظهر|VF4", "e", "غالب کر"],
    ["عجز|VF4", "e", "عاجز کر"],
    ["عذر|VF8", "el", "عذر کر"],
    ["عطو|VF4", "e", "دے"],
    ["عقب|VF4", "ef", "سزا دے"],
    ["عمر|VF1", "e", "آباد کر", "au", "عِمَارَةٌ"],
    ["غلظ|VF1", "efl", "سختی کر", "uu", "غِلْظَةٌ"],
    ["غنم|VF1", "ef", "غنیمت پا", "ia", "غُنْمٌ"],
    ["قلل|VF2", "e", "کم کر"],
    ["قوم|VF10", "l", "قائم رہ"],
    ["كنز|VF1", "e", "جمع کر", "ai", "كَنْزٌ"],
    ["كوي|VF1", "e", "داغ", "ai", "كَيٌّ"],
    ["لمز|VF1", "e", "عیب لگا", "ai", "لَمْزٌ"],
    ["مضي|VF1", "l", "گزر", "ai", "مُضِيٌّ"],
    ["مكن|VF4", "e", "قابو دے"],
    ["نصر|VF10", "ef", "مدد مانگ"],
    ["نقص|VF1", "ef", "کمی کر", "au", "نَقْصٌ"],
    ["نكص|VF1", "l", "الٹے پاؤں پھر", "ai", "نُكُوصٌ"],
    ["وضع|VF4", "e", "دوڑا"],
    ["وطأ|VF3", "e", "موافق کر"],
    ["وعد|VF6", "el", "باہم وعدہ کر"],
    // Para 11
    ["أسس|VF2", "ef", "بنیاد رکھ"],
    ["بني|VF1", "e", "بنا", "ai", "بِنَاءٌ"],
    ["بوأ|VF5", "e", "ٹھکانا بنا"],
    ["بيع|VF3", "ef", "بیعت کر"],
    ["ثني|VF1", "e", "موڑ", "ai", "ثَنْيٌ"],
    ["جمع|VF4", "e", "اکٹھا کر"],
    ["حكم|VF4", "e", "پختہ کر"],
    ["خلط|VF1", "e", "ملا", "ai", "خَلْطٌ"],
    ["خلف|VF2", "e", "ملتوی کر"],
    ["خلف|VF5", "l", "پیچھے رہ"],
    ["دبر|VF2", "ef", "تدبیر کر"],
    ["دري|VF4", "ef", "خبر دے"],
    ["رهق|VF1", "l", "چھا", "ia", "رَهَقٌ"],
    ["زيغ|VF1", "l", "ٹیڑھا ہو", "ai", "زَيْغٌ"],
    ["زيل|VF2", "ef", "تفریق ڈال"],
    ["زين|VF5", "l", "خوبصورت ہو"],
    ["سلف|VF4", "e", "پہلے بھیج"],
    ["سير|VF2", "e", "چلا"],
    ["شدد|VF1", "e", "مضبوط باندھ", "au", "شَدٌّ"],
    ["صرف|VF7", "e", "منہ پھیر"],
    ["عجل|VF2", "e", "جلدی دے"],
    ["عرف|VF6", "el", "ایک دوسرے کو پہچان"],
    ["عرف|VF8", "e", "اعتراف کر"],
    ["عزب|VF1", "l", "چھپا رہ", "au", "عُزُوبٌ"],
    ["عود|VF4", "e", "لوٹا"],
    ["غشو|VF10", "e", "اوڑھ"],
    ["غيظ|VF1", "e", "غصہ دلا", "ai", "غَيْظٌ"],
    ["فقه|VF5", "ef", "سمجھ بوجھ حاصل کر"],
    ["قدر|VF2", "e", "اندازہ مقرر کر"],
    ["كره|VF4", "e", "مجبور کر"],
    ["لفت|VF1", "e", "پھیر", "ai", "لَفْتٌ"],
    ["مرد|VF1", "lx", "اڑ", "au", "مُرُودٌ"],
    ["نبأ|VF10", "e", "پوچھ"],
    ["هور|VF7", "l", "گر پڑ"],
    ["وطأ|VF1", "e", "پامال کر", "ia", "وَطْءٌ"],
    ["ولي|VF1", "l", "قریب ہو", "ii", "وِلَايَةٌ"],
    // Para 12
    ["أوي|VF1", "efl", "پناہ لے", "ai", "أُوِيٌّ"],
    ["بأس|VF8", "el", "غم کر"],
    ["بلع|VF1", "e", "نگل", "ia", "بَلْعٌ"],
    ["ترف|VF4", "ef", "آسودگی دے"],
    ["حصحص|VF1", "l", "واضح ہو"],
    ["حصد|VF1", "e", "کاٹ", "au", "حَصَادٌ"],
    ["خبت|VF4", "efl", "عاجزی کر"],
    ["خطب|VF3", "l", "مخاطب ہو"],
    ["خلف|VF3", "e", "خلاف کر"],
    ["ذكر|VF8", "e", "یاد کر"],
    ["رتع|VF1", "l", "چر", "aa", "رَتْعٌ"],
    ["رجم|VF1", "e", "سنگسار کر", "au", "رَجْمٌ"],
    ["رقب|VF8", "e", "انتظار کر"],
    ["ركب|VF1", "l", "سوار ہو", "ia", "رُكُوبٌ"],
    ["ركن|VF1", "l", "مائل ہو", "ia", "رُكُونٌ"],
    ["رود|VF3", "e", "پھسلا"],
    ["زرع|VF1", "e", "اگا", "aa", "زَرْعٌ"],
    ["زري|VF8", "e", "حقیر سمجھ"],
    ["سجن|VF1", "e", "قید کر", "au", "سَجْنٌ"],
    ["سري|VF4", "", "رات کو لے چل", null, null, { pu: "رات کو چلا" }],
    ["سعد|VF1", "l", "نیک بخت ہو", "ia", "سَعَادَةٌ"],
    ["سول|VF2", "e", "اچھا بنا کر دکھا"],
    ["شغف|VF1", "e", "بے قابو کر", "aa", "شَغْفٌ"],
    ["شقو|VF1", "l", "بدبخت ہو", "ia", "شَقَاوَةٌ"],
    ["صبو|VF1", "l", "مائل ہو", "au", "صَبْوٌ"],
    ["طرح|VF1", "e", "پھینک", "aa", "طَرْحٌ"],
    ["طغي|VF1", "efl", "سرکشی کر", "aa", "طُغْيَانٌ"],
    ["عبر|VF1", "ef", "تعبیر بتا", "au", "عِبَارَةٌ"],
    ["عرو|VF8", "e", "آسیب پہنچا"],
    ["عصر|VF1", "e", "نچوڑ", "ai", "عَصْرٌ"],
    ["عصم|VF10", "l", "بچا رہ"],
    ["عمر|VF10", "e", "آباد کر"],
    ["عمي|VF2", "e", "چھپا"],
    ["غلق|VF2", "e", "بند کر"],
    ["غيث|VF4", "ef", "فریاد رسی کر"],
    ["غيض|VF1", "ef", "کمی کر", "ai", "غَيْضٌ"],
    ["فور|VF1", "l", "ابل پڑ", "au", "فَوْرٌ"],
    ["قدد|VF1", "e", "پھاڑ", "au", "قَدٌّ"],
    ["قدم|VF1", "ef", "قیادت کر", "au", "قُدُومٌ"],
    ["قلع|VF4", "l", "تھم"],
    ["كبر|VF4", "e", "بڑا سمجھ"],
    ["كثر|VF4", "ef", "کثرت کر"],
    ["كرم|VF4", "ef", "عزت کر"],
    ["كلم|VF5", "ef", "بات کر"],
    ["لزم|VF4", "e", "لازم کر"],
    ["لفت|VF8", "e", "مڑ کر دیکھ"],
    ["لقط|VF8", "e", "اٹھا"],
    ["لوم|VF1", "ef", "ملامت کر", "au", "لَوْمٌ"],
    ["نجو|VF1", "efl", "نجات پا", "au", "نَجَاةٌ"],
    ["نكر|VF1", "l", "انجان ہو", "ia", "نُكْرٌ"],
    ["نوب|VF4", "el", "رجوع کر"],
    ["هرع|VF1", "e", "دوڑا", "aa", "هَرَعٌ"],
    ["وجس|VF4", "e", "دل میں محسوس کر"],
    ["ورد|VF4", "", "لے آ", null, null, { pu: "پہنچا" }],
    ["ولد|VF1", "e", "جن", "ai", "وِلَادَةٌ"],
    // Para 13
    ["أثر|VF4", "ef", "ترجیح دے"],
    ["برأ|VF2", "e", "بری الذمہ کر"],
    ["برح|VF1", "l", "ٹل", "ia", "بَرَاحٌ"],
    ["جثث|VF8", "e", "اکھاڑ"],
    ["جرع|VF5", "e", "گھونٹ گھونٹ پی"],
    ["جزع|VF1", "el", "جزع فزع کر", "ia", "جَزَعٌ"],
    ["جنب|VF1", "e", "بچا", "au", "جَنْبٌ"],
    ["جهر|VF1", "e", "ظاہر کر", "aa", "جَهْرٌ"],
    ["جهز|VF2", "e", "تیار کر"],
    ["حسس|VF5", "ef", "ٹوہ لگا"],
    ["حصي|VF4", "e", "شمار کر"],
    ["خرج|VF10", "e", "نکال"],
    ["خلص|VF1", "l", "اکیلے ہو", "au", "خُلُوصٌ"],
    ["خلص|VF10", "e", "خالص کر"],
    ["خيب|VF1", "l", "نامراد ہو", "ai", "خَيْبَةٌ"],
    ["زول|VF1", "l", "ٹل", "au", "زَوَالٌ"],
    ["سخر|VF2", "e", "مسخر کر"],
    ["سرق|VF1", "ef", "چوری کر", "ai", "سَرِقَةٌ"],
    ["سكن|VF4", "e", "بسا"],
    ["سوغ|VF4", "e", "نگل"],
    ["سيل|VF1", "l", "بہ", "ai", "سَيْلٌ"],
    ["شخص|VF1", "lx", "پتھرا", "aa", "شُخُوصٌ"],
    ["شدد|VF8", "l", "سخت ہو"],
    ["شكو|VF1", "ef", "شکایت کر", "au", "شَكْوَى"],
    ["صدد|VF2", "e", "روک"],
    ["صلح|VF1", "l", "صالح ہو", "au", "صَلَاحٌ"],
    ["عدد|VF1", "e", "شمار کر", "au", "عَدٌّ"],
    ["فتأ|VF1", "l", "ہمیشہ کرتا رہ", "ia", "فَتْءٌ"],
    ["فقد|VF1", "e", "گم پا", "ai", "فَقْدٌ"],
    ["فند|VF2", "e", "بہکا ہوا کہ"],
    ["قبل|VF4", "l", "متوجہ ہو"],
    ["كيل|VF8", "e", "ناپ کر لے"],
    ["لحق|VF4", "e", "ملا"],
    ["محو|VF1", "e", "مٹا", "au", "مَحْوٌ"],
    ["مكث|VF1", "l", "ٹھہر", "au", "مُكْثٌ"],
    ["مير|VF1", "l", "غلہ لا", "ai", "مَيْرٌ"],
    ["نكر|VF4", "e", "انکار کر"],
    ["يأس|VF10", "l", "مایوس ہو"],
    // Para 14
    ["جأر|VF1", "ef", "فریاد کر", "aa", "جُؤَارٌ"],
    ["خسف|VF1", "e", "دھنسا", "ai", "خَسْفٌ"],
    ["خفض|VF1", "e", "جھکا", "ai", "خَفْضٌ"],
    ["خفف|VF10", "e", "ہلکا سمجھ"],
    ["دسس|VF1", "e", "دبا", "au", "دَسٌّ"],
    ["روح|VF4", "l", "واپس لا"],
    ["سرح|VF1", "l", "چرانے جا", "aa", "سَرْحٌ"],
    ["سرق|VF8", "e", "چرا"],
    ["سقي|VF4", "e", "پلا"],
    ["سكر|VF2", "e", "مدہوش کر"],
    ["سلك|VF1", "e", "چلا", "au", "سُلُوكٌ"],
    ["سوم|VF4", "e", "مویشی چرا"],
    ["شهو|VF8", "ef", "خواہش کر"],
    ["صدع|VF1", "e", "کھول کر سنا", "aa", "صَدْعٌ"],
    ["ظلل|VF1", "l", "ہو جا", "ia", "ظُلُولٌ", { pc: "ظَلْ" }],
    ["عتب|VF10", "e", "عذر قبول کر"],
    ["عرج|VF1", "l", "چڑھ", "au", "عُرُوجٌ"],
    ["عقب|VF3", "e", "بدلہ لے"],
    ["فضح|VF1", "e", "رسوا کر", "aa", "فَضِيحَةٌ"],
    ["فيأ|VF5", "l", "ڈھل"],
    ["قنط|VF1", "l", "مایوس ہو", "aa", "قُنُوطٌ"],
    ["لهو|VF4", "e", "غافل کر"],
    ["ميد|VF1", "l", "ڈگمگا", "ai", "مَيْدٌ"],
    ["نفد|VF1", "l", "ختم ہو", "ia", "نَفَادٌ"],
    ["وري|VF6", "l", "چھپ"],
    // Para 15
    ["بذر|VF2", "e", "بے جا خرچ کر"],
    ["بيد|VF1", "l", "برباد ہو", "ai", "بَيْدٌ"],
    ["تبر|VF2", "e", "تباہ کر"],
    ["جلب|VF4", "l", "چڑھا لا"],
    ["جمع|VF8", "l", "جمع ہو"],
    ["جوس|VF1", "l", "گھس", "au", "جَوْسٌ"],
    ["حدث|VF4", "e", "بیان کر"],
    ["حفف|VF1", "e", "گھیر", "au", "حَفٌّ"],
    ["حلي|VF2", "e", "زیور پہنا"],
    ["حنك|VF8", "e", "قابو میں کر"],
    ["حور|VF3", "ef", "بات چیت کر"],
    ["خبو|VF1", "l", "آہستہ ہو", "au", "خُبُوٌّ"],
    ["خفت|VF3", "e", "پست کر"],
    ["دحض|VF4", "e", "زائل کر"],
    ["ذرو|VF1", "e", "اڑا", "au", "ذَرْوٌ"],
    ["ربو|VF2", "e", "پال"],
    ["رقي|VF1", "l", "چڑھ", "ia", "رُقِيٌّ"],
    ["رهق|VF4", "e", "سختی میں ڈال"],
    ["زجو|VF4", "e", "چلا"],
    ["زور|VF6", "l", "بچ کر نکل"],
    ["سقط|VF4", "e", "گرا"],
    ["سوأ|VF4", "e", "برا کر"],
    ["شرك|VF3", "l", "شریک ہو"],
    ["شوي|VF1", "e", "بھون", "ai", "شَيٌّ"],
    ["صفو|VF4", "e", "چن"],
    ["طلع|VF1", "l", "طلوع ہو", "au", "طُلُوعٌ"],
    ["طلق|VF7", "l", "چل پڑ"],
    ["عثر|VF4", "e", "مطلع کر"],
    ["علو|VF1", "l", "غالب آ", "au", "عُلُوٌّ"],
    ["غدر|VF3", "e", "چھوڑ"],
    ["غرب|VF1", "l", "غروب ہو", "au", "غُرُوبٌ"],
    ["غفل|VF4", "e", "غافل کر"],
    ["غوث|VF4", "ef", "فریاد رسی کر"],
    ["فجر|VF1", "e", "جاری کر", "au", "فَجْرٌ"],
    ["فجر|VF2", "e", "پھاڑ"],
    ["فزز|VF10", "e", "اکھاڑ"],
    ["قرض|VF1", "lx", "کترا", "ai", "قَرْضٌ"],
    ["قفو|VF1", "l", "پیچھے پڑ", "au", "قَفْوٌ"],
    ["كرم|VF2", "ef", "عزت بخش"],
    ["كيل|VF1", "e", "ناپ", "ai", "كَيْلٌ"],
    ["لطف|VF5", "ef", "نرمی کر"],
    ["مري|VF3", "e", "جھگڑا کر"],
    ["نزل|VF1", "l", "اتر", "ai", "نُزُولٌ"],
    ["نشر|VF1", "e", "پھیلا", "au", "نَشْرٌ"],
    ["نغض|VF4", "e", "سر ہلا"],
    ["نهر|VF1", "e", "جھڑک", "aa", "نَهْرٌ"],
    ["هجد|VF5", "e", "تہجد پڑھ"],
    ["هيأ|VF2", "e", "مہیا کر"],
    ["وزن|VF1", "e", "تول", "ai", "وَزْنٌ"],
    // Para 16
    ["أزز|VF1", "e", "ابھار", "au", "أَزٌّ"],
    ["بدل|VF4", "e", "بدل دے"],
    ["بصر|VF1", "e", "دیکھ", "uu", "بَصَرٌ"],
    ["بغي|VF7", "l", "لائق ہو"],
    ["جوع|VF1", "l", "بھوکا رہ", "au", "جُوعٌ"],
    ["حرق|VF2", "e", "جلا"],
    ["خزي|VF1", "l", "رسوا ہو", "ia", "خِزْيٌ"],
    ["خشع|VF1", "lx", "دب", "aa", "خُشُوعٌ"],
    ["خفت|VF6", "efl", "سرگوشی کر"],
    ["خلع|VF1", "e", "اتار", "aa", "خَلْعٌ"],
    ["خيل|VF2", "e", "خیال میں ڈال"],
    ["ذلل|VF1", "l", "ذلیل ہو", "ai", "ذُلٌّ"],
    ["ردي|VF1", "l", "ہلاک ہو", "ia", "رَدًى"],
    ["رعي|VF1", "e", "چرا", "aa", "رَعْيٌ"],
    ["زكو|VF5", "ef", "پاکیزگی اختیار کر"],
    ["سحت|VF4", "e", "فنا کر"],
    ["سقط|VF3", "e", "گرا"],
    ["سوي|VF3", "e", "برابر کر"],
    ["شعل|VF8", "l", "بھڑک"],
    ["شقق|VF7", "l", "شق ہو"],
    ["شور|VF4", "e", "اشارہ کر"],
    ["صبر|VF8", "l", "جما رہ"],
    ["صحب|VF3", "e", "ساتھ رکھ"],
    ["صنع|VF8", "e", "بنا"],
    ["ضحو|VF1", "e", "دھوپ کھا", "ia", "ضُحًى"],
    ["ضمم|VF1", "e", "ملا", "au", "ضَمٌّ"],
    ["ضيف|VF2", "e", "مہمان بنا"],
    ["طعم|VF10", "e", "کھانا مانگ"],
    ["طول|VF1", "l", "لمبا ہو", "au", "طُولٌ"],
    ["ظمأ|VF1", "l", "پیاسا ہو", "ia", "ظَمَأٌ"],
    ["عجل|VF4", "l", "جلدی لا"],
    ["عري|VF1", "l", "ننگا ہو", "ia", "عُرْيٌ"],
    ["علو|VF10", "l", "غالب ہو"],
    ["عنو|VF1", "l", "جھک", "au", "عُنُوٌّ"],
    ["عون|VF4", "ef", "مدد کر"],
    ["عيب|VF1", "e", "عیب دار کر", "ai", "عَيْبٌ"],
    ["غوي|VF1", "l", "بھٹک", "ai", "غَيٌّ"],
    ["فرط|VF1", "ef", "زیادتی کر", "au", "فَرْطٌ"],
    ["قذف|VF1", "e", "ڈال", "ai", "قَذْفٌ"],
    ["قرر|VF1", "l", "ٹھنڈا ہو", "ia", "قَرَارٌ"],
    ["قضض|VF7", "lx", "ٹوٹ"],
    ["مثل|VF5", "ef", "شکل اختیار کر"],
    ["موج|VF1", "e", "لہریں مار", "au", "مَوْجٌ"],
    ["نبذ|VF8", "l", "الگ ہو"],
    ["نزل|VF5", "l", "اتر"],
    ["نسف|VF1", "e", "اکھاڑ", "ai", "نَسْفٌ"],
    ["هزز|VF1", "e", "ہلا", "au", "هَزٌّ"],
    ["هشش|VF1", "e", "پتے جھاڑ", "au", "هَشٌّ"],
    ["وكأ|VF5", "e", "سہارا لے"],
    ["وني|VF1", "ef", "سستی کر", "ai", "وَنْيٌ"],
    ["يسر|VF2", "e", "آسان کر"],
    // Para 17
    ["أذن|VF4", "e", "خبردار کر"],
    ["حسر|VF10", "l", "اکتا"],
    ["دفع|VF3", "ef", "مدافعت کر"],
    ["دمغ|VF1", "e", "سر توڑ", "aa", "دَمْغٌ"],
    ["ذهل|VF1", "lx", "بھول", "aa", "ذُهُولٌ"],
    ["ربو|VF1", "l", "بڑھ", "au", "رِبًا"],
    ["رضو|VF8", "e", "پسند کر"],
    ["ركض|VF1", "l", "دوڑ", "au", "رَكْضٌ"],
    ["سبح|VF1", "l", "تیر", "aa", "سَبْحٌ"],
    ["سطو|VF1", "e", "حملہ کر", "au", "سَطْوَةٌ"],
    ["سلب|VF1", "e", "چھین", "au", "سَلْبٌ"],
    ["صبب|VF1", "e", "ڈال", "au", "صَبٌّ"],
    ["صحب|VF1", "e", "ساتھ دے", "ia", "صُحْبَةٌ"],
    ["صهر|VF1", "e", "گلا", "aa", "صَهْرٌ"],
    ["طوي|VF1", "e", "لپیٹ", "ai", "طَيٌّ"],
    ["عظم|VF2", "ef", "تعظیم کر"],
    ["غوص|VF1", "e", "غوطہ لگا", "au", "غَوْصٌ"],
    ["فتر|VF1", "e", "دم لے", "au", "فُتُورٌ"],
    ["فتق|VF1", "e", "جدا کر", "au", "فَتْقٌ"],
    ["فهم|VF2", "e", "سمجھا"],
    ["قصم|VF1", "e", "ہلاک کر", "ai", "قَصْمٌ"],
    ["كلأ|VF1", "ef", "نگہبانی کر", "aa", "كِلَاءَةٌ"],
    ["مني|VF1", "ef", "تمنا کر", "ai", "مَنْيٌ"],
    ["نزع|VF3", "e", "جھگڑا کر"],
    ["نسل|VF1", "l", "دوڑ", "ai", "نُسُولٌ"],
    ["نشر|VF4", "e", "زندہ کر"],
    ["نطق|VF1", "l", "بول", "ai", "نُطْقٌ"],
    ["نفش|VF1", "l", "رات کو چر", "au", "نَفْشٌ"],
    ["نقذ|VF10", "e", "چھڑا"],
    ["نكس|VF1", "e", "الٹا", "au", "نَكْسٌ"],
    ["هدم|VF2", "e", "ڈھا"],
    ["هزز|VF8", "lx", "ہل"],
    ["هون|VF4", "e", "رسوا کر"],
    ["وجب|VF1", "l", "گر", "ai", "وُجُوبٌ"],
    ["ورد|VF1", "l", "وارد ہو", "ai", "وُرُودٌ"],
    // Para 18
    ["ألو|VF8", "efl", "قسم کھا"],
    ["أنس|VF10", "el", "انس حاصل کر"],
    ["جلد|VF1", "e", "کوڑے مار", "ai", "جَلْدٌ"],
    ["حيف|VF1", "e", "ظلم کر", "ai", "حَيْفٌ"],
    ["خسأ|VF1", "l", "دور ہو", "aa", "خُسُوءٌ"],
    ["زكو|VF1", "l", "پاک ہو", "au", "زَكَاةٌ"],
    ["سلل|VF5", "lx", "کھسک"],
    ["شيع|VF1", "l", "پھیل", "ai", "شُيُوعٌ"],
    ["غضض|VF1", "e", "جھکا", "au", "غَضٌّ"],
    ["فضل|VF5", "ef", "فضیلت حاصل کر"],
    ["قلب|VF5", "l", "الٹ پلٹ ہو"],
    ["كتب|VF3", "ef", "مکاتبت کر"],
    ["كتب|VF8", "e", "لکھوا"],
    ["لجج|VF1", "l", "اڑا رہ", "ia", "لَجَاجٌ"],
    ["لفح|VF1", "e", "جھلسا", "aa", "لَفْحٌ"],
    ["نبت|VF1", "l", "اگ", "au", "نَبَاتٌ"],
    // Para 19
    ["برز|VF2", "e", "کھول"],
    ["بسم|VF5", "l", "مسکرا"],
    ["بيت|VF1", "ef", "رات گزار", "ai", "بَيْتُوتَةٌ"],
    ["حطم|VF1", "e", "کچل", "ai", "حَطْمٌ"],
    ["خلد|VF1", "l", "ہمیشہ رہ", "au", "خُلُودٌ"],
    ["رتل|VF2", "e", "ٹھہر ٹھہر کر پڑھ"],
    ["زلف|VF4", "e", "قریب کر"],
    ["زني|VF1", "el", "زنا کر", "ai", "زِنًا"],
    ["صلي|VF8", "e", "آگ تاپ"],
    ["عبأ|VF1", "ef", "پروا کر", "aa", "عَبْءٌ"],
    ["عبث|VF1", "e", "بے کار کام کر", "aa", "عَبَثٌ"],
    ["عبد|VF2", "e", "غلام بنا"],
    ["عقب|VF2", "e", "پلٹ کر دیکھ"],
    ["فرر|VF1", "lx", "بھاگ", "ai", "فِرَارٌ"],
    ["فقد|VF5", "ef", "خبر لے"],
    ["فلق|VF7", "lx", "پھٹ"],
    ["قتر|VF1", "e", "بخل کر", "au", "قَتْرٌ"],
    ["قسم|VF6", "efl", "آپس میں قسم کھا"],
    ["كبكب|VF1", "e", "اوندھے منہ گرا"],
    ["لقي|VF2", "e", "سکھا"],
    ["مرج|VF1", "e", "ملا", "au", "مَرْجٌ"],
    ["مرض|VF1", "l", "بیمار ہو", "ia", "مَرَضٌ"],
    ["نصر|VF8", "e", "بدلہ لے"],
    ["نكر|VF2", "e", "بدل ڈال"],
    ["هيم|VF1", "l", "بھٹک", "ai", "هَيَمَانٌ"],
    ["وزع|VF1", "e", "ضبط میں رکھ", "aa", "وَزْعٌ"],
    ["وزع|VF4", "ef", "توفیق دے"],
    ["يقن|VF10", "e", "یقین کر"],
    // Para 20
    ["أجر|VF1", "ef", "نوکری کر", "au", "أَجْرٌ"],
    ["أجر|VF10", "e", "اجرت پر رکھ"],
    ["أمر|VF8", "el", "مشورہ کر"],
    ["بدأ|VF4", "ef", "ابتدا کر"],
    ["بطر|VF1", "l", "اترا", "ia", "بَطَرٌ"],
    ["تقن|VF4", "e", "مضبوط بنا"],
    ["جبي|VF1", "e", "کھینچ", "ai", "جِبَايَةٌ"],
    ["ذود|VF1", "e", "ہٹا", "au", "ذَوْدٌ"],
    ["ردف|VF1", "l", "پیچھے لگ", "ia", "رَدْفٌ"],
    ["رقب|VF5", "e", "خطرہ بھانپ"],
    ["شقق|VF1", "ef", "سختی کر", "au", "شَقٌّ"],
    ["صدر|VF4", "l", "واپس نکال لا"],
    ["صدق|VF2", "ef", "تصدیق کر"],
    ["صرخ|VF10", "e", "پکار"],
    ["طول|VF6", "l", "دراز ہو"],
    ["فزع|VF1", "lx", "گھبرا", "ia", "فَزَعٌ"],
    ["قلب|VF1", "e", "پھیر", "ai", "قَلْبٌ"],
    ["كبب|VF1", "e", "اوندھا ڈال", "au", "كَبٌّ"],
    ["نوأ|VF1", "l", "بھاری ہو", "au", "نَوْءٌ"],
    ["وجه|VF5", "e", "رخ کر"],
    ["وصل|VF2", "e", "پے در پے بھیج"],
    ["وكز|VF1", "e", "گھونسا مار", "ai", "وَكْزٌ"],
    // Para 21
    ["أسر|VF1", "e", "قید کر", "ai", "أَسْرٌ"],
    ["بلس|VF4", "l", "ناامید ہو"],
    ["جفو|VF1", "l", "الگ رہ", "au", "جَفَاءٌ"],
    ["جفو|VF6", "l", "الگ رہ"],
    ["حبر|VF1", "e", "خوش کر", "au", "حُبُورٌ"],
    ["حبط|VF4", "e", "ضائع کر"],
    ["خطط|VF1", "e", "لکھ", "au", "خَطٌّ"],
    ["دور|VF1", "l", "گھوم", "au", "دَوْرٌ"],
    ["سبغ|VF4", "e", "تمام کر"],
    ["سلق|VF1", "ef", "بد زبانی کر", "aa", "سَلْقٌ"],
    ["صدع|VF5", "l", "متفرق ہو"],
    ["صعر|VF2", "e", "گال پھیر"],
    ["عمد|VF5", "e", "جان بوجھ کر ارادہ کر"],
    ["قصد|VF1", "ef", "میانہ روی اختیار کر", "ai", "قَصْدٌ"],
    ["مسو|VF4", "e", "شام کر"],
    ["مهد|VF1", "ef", "راہ ہموار کر", "aa", "مَهْدٌ"],
    ["نشر|VF8", "l", "پھیل"],
    // Para 22
    ["أوب|VF2", "e", "تسبیح دہرا"],
    ["برج|VF5", "ef", "زینت کا اظہار کر"],
    ["بعد|VF3", "ef", "دوری پیدا کر"],
    ["بور|VF1", "l", "تباہ ہو", "au", "بَوَارٌ"],
    ["جزي|VF3", "e", "بدلہ دے"],
    ["جور|VF3", "l", "ہمسایہ رہ"],
    ["خضع|VF1", "efl", "نرمی کر", "aa", "خُضُوعٌ"],
    ["دنو|VF4", "e", "لٹکا"],
    ["زوج|VF2", "e", "بیاہ دے"],
    ["سيل|VF4", "e", "بہا"],
    ["شفق|VF4", "l", "ڈر"],
    ["صرخ|VF8", "efl", "فریاد کر"],
    ["صعد|VF1", "l", "چڑھ", "ia", "صُعُودٌ"],
    ["عدد|VF8", "ef", "گنتی پوری کر"],
    ["عزز|VF2", "ef", "قوت دے"],
    ["عزل|VF1", "e", "الگ کر", "ai", "عَزْلٌ"],
    ["فزع|VF2", "e", "خوف دور کر"],
    ["فيأ|VF4", "e", "لوٹا"],
    ["لين|VF4", "e", "نرم کر"],
    ["مزق|VF2", "e", "تتر بتر کر"],
    ["نكح|VF10", "e", "نکاح کر"],
    ["ودع|VF1", "e", "چھوڑ", "aa", "وَدْعٌ"],
    // Para 23
    ["أبق|VF1", "lx", "بھاگ", "ai", "إِبَاقٌ"],
    ["تلل|VF1", "e", "گرا", "au", "تَلٌّ"],
    ["حنث|VF1", "ef", "قسم توڑ", "ia", "حِنْثٌ"],
    ["دعو|VF8", "e", "طلب کر"],
    ["ذلل|VF2", "e", "مطیع کر"],
    ["رقي|VF8", "l", "اوپر چڑھ"],
    ["روغ|VF1", "l", "چپکے سے جا", "au", "رَوْغٌ"],
    ["زفف|VF1", "l", "دوڑ", "ai", "زَفٌّ"],
    ["سخر|VF10", "e", "مذاق اڑا"],
    ["سلخ|VF1", "e", "نکال", "aa", "سَلْخٌ"],
    ["سمع|VF5", "e", "کان لگا کر سن"],
    ["سهم|VF3", "e", "قرعہ ڈال"],
    ["سور|VF5", "e", "دیوار پھاند"],
    ["شطط|VF4", "ef", "زیادتی کر"],
    ["طوف|VF1", "lp", "پھر", "au", "طَوْفٌ", { pu: "پھرا" }],
    ["عزز|VF1", "ef", "غلبہ پا", "au", "عِزٌّ"],
    ["فدي|VF1", "e", "چھڑا", "ai", "فِدَاءٌ"],
    ["كفل|VF4", "e", "سونپ"],
    ["كور|VF2", "e", "لپیٹ"],
    ["لقم|VF8", "e", "لقمہ بنا"],
    ["مسخ|VF1", "e", "مسخ کر", "aa", "مَسْخٌ"],
    ["ميز|VF8", "l", "الگ ہو"],
    ["نزف|VF4", "ef", "عقل زائل کر"],
    ["نصر|VF6", "efl", "ایک دوسرے کی مدد کر"],
    ["نكس|VF2", "e", "الٹا کر"],
    ["هيج|VF1", "l", "خشک ہو", "ai", "هَيْجٌ"],
    // Para 24
    ["بشر|VF4", "efl", "خوش خبری پا"],
    ["حجج|VF6", "l", "باہم جھگڑ"],
    ["حسب|VF8", "e", "اندازہ کر"],
    ["ستر|VF8", "l", "چھپ"],
    ["سجر|VF1", "e", "جھونک", "au", "سَجْرٌ"],
    ["سحب|VF1", "e", "گھسیٹ", "aa", "سَحْبٌ"],
    ["شرق|VF4", "l", "چمک اٹھ"],
    ["صعق|VF1", "l", "بے ہوش ہو", "ia", "صَعْقٌ"],
    ["فوض|VF2", "e", "سپرد کر"],
    ["قيض|VF2", "e", "مقرر کر"],
    ["لغو|VF1", "efl", "بے ہودہ گوئی کر", "ia", "لَغْوٌ"],
    ["مرح|VF1", "l", "اترا", "ia", "مَرَحٌ"],
    ["نطق|VF4", "e", "بلوا"],
    // Para 25
    ["أسف|VF4", "e", "غصہ دلا"],
    ["برم|VF4", "e", "مقرر کر"],
    ["بين|VF4", "ef", "واضح بات کر"],
    ["جرح|VF8", "e", "کما"],
    ["شرع|VF1", "e", "مقرر کر", "aa", "شَرْعٌ"],
    ["صير|VF1", "l", "لوٹ", "ai", "صَيْرُورَةٌ"],
    ["عتل|VF1", "e", "گھسیٹ", "ai", "عَتْلٌ"],
    ["عشو|VF1", "ef", "غفلت برت", "au", "عَشْوٌ"],
    ["غلي|VF1", "e", "جوش کھا", "ai", "غَلْيٌ"],
    ["فتر|VF2", "e", "کم کر"],
    ["قسم|VF1", "ef", "تقسیم کر", "ai", "قَسْمٌ"],
    ["لذذ|VF1", "efl", "لذت پا", "ia", "لَذَّةٌ"],
    ["لقي|VF3", "l", "جا مل"],
    ["نسخ|VF10", "e", "لکھوا"],
    ["نشأ|VF2", "e", "پال"],
    ["وبق|VF4", "e", "ہلاک کر"],
    ["وكأ|VF8", "e", "تکیہ لگا"],
    // Para 26
    ["أزر|VF4", "ef", "تقویت دے"],
    ["جسس|VF5", "e", "تجسس کر"],
    ["جوز|VF6", "el", "درگزر کر"],
    ["حبب|VF2", "e", "پسندیدہ بنا"],
    ["حفو|VF4", "e", "اصرار کر"],
    ["حيد|VF1", "l", "بدک", "ai", "حَيْدٌ"],
    ["زيل|VF5", "l", "جدا ہو"],
    ["سخط|VF4", "e", "غصہ دلا"],
    ["شغل|VF1", "e", "مشغول کر", "aa", "شُغْلٌ"],
    ["صكك|VF1", "e", "ہاتھ مار", "au", "صَكٌّ"],
    ["صمم|VF4", "e", "بہرا کر"],
    ["طغي|VF4", "e", "سرکش بنا"],
    ["ظفر|VF4", "e", "غلبہ عطا کر"],
    ["عرف|VF2", "ef", "پہچان کرا"],
    ["عيي|VF1", "lx", "تھک", "ia", "عِيٌّ"],
    ["غلظ|VF10", "l", "سخت ہو"],
    ["غيب|VF8", "ef", "غیبت کر"],
    ["غير|VF5", "l", "تبدیل ہو"],
    ["قدم|VF5", "l", "پہلے ہو"],
    ["كره|VF2", "e", "مکروہ بنا"],
    ["لفظ|VF1", "e", "بول", "ai", "لَفْظٌ"],
    ["ليت|VF1", "ef", "کمی کر", "ai", "لَيْتٌ"],
    ["محن|VF8", "e", "جانچ"],
    ["ملأ|VF8", "lx", "بھر"],
    ["نبز|VF6", "e", "باہم بدنام کر"],
    ["نقب|VF2", "e", "چھان مار"],
    ["هجع|VF1", "l", "سو", "aa", "هُجُوعٌ"],
    ["وتر|VF1", "ef", "حق تلفی کر", "ai", "وَتْرٌ"],
    ["وقر|VF2", "ef", "تعظیم کر"],
    // Para 27
    ["أزف|VF1", "l", "نزدیک آ", "ia", "أَزَفٌ"],
    ["ألت|VF1", "e", "کم کر", "ai", "أَلْتٌ"],
    ["أني|VF1", "l", "وقت آ", "ai", "أَنًى"],
    ["بدع|VF8", "e", "ایجاد کر"],
    ["برأ|VF1", "e", "پیدا کر", "aa", "بَرْءٌ"],
    ["بسس|VF1", "e", "اڑا", "au", "بَسٌّ"],
    ["بكي|VF4", "e", "رلا"],
    ["حرث|VF1", "e", "بیج بو", "au", "حَرْثٌ"],
    ["خسر|VF4", "e", "نقصان دے"],
    ["خير|VF5", "e", "چن"],
    ["دعع|VF1", "e", "دھکے دے", "au", "دَعٌّ"],
    ["دلو|VF1", "e", "ڈول ڈال", "au", "دَلْوٌ"],
    ["دلو|VF5", "l", "اتر آ"],
    ["دنو|VF1", "l", "قریب آ", "au", "دُنُوٌّ"],
    ["رجج|VF1", "e", "ہلا", "au", "رَجٌّ"],
    ["زجر|VF8", "e", "ڈانٹ"],
    ["سبق|VF3", "l", "ایک دوسرے سے آگے بڑھ"],
    ["صبح|VF2", "ef", "صبح کر"],
    ["صدع|VF2", "e", "درد سر دے"],
    ["ضحك|VF4", "e", "ہنسا"],
    ["طمث|VF1", "e", "چھو", "ai", "طَمْثٌ"],
    ["عطو|VF1", "e", "لے", "au", "عَطْوٌ"],
    ["عطو|VF6", "e", "ہاتھ بڑھا کر پکڑ"],
    ["فرش|VF1", "e", "بچھا", "aa", "فَرْشٌ"],
    ["فرغ|VF1", "l", "فارغ ہو", "au", "فَرَاغٌ"],
    ["فكه|VF5", "e", "باتیں بنا"],
    ["قبس|VF8", "ef", "روشنی حاصل کر"],
    ["قني|VF4", "e", "دولت مند کر"],
    ["قول|VF5", "e", "گھڑ"],
    ["كدي|VF4", "e", "بند کر"],
    ["لمس|VF8", "e", "تلاش کر"],
    ["مري|VF1", "e", "جھگڑ", "ai", "مِرَاءٌ"],
    ["مري|VF6", "l", "جھگڑ"],
    ["مني|VF4", "e", "ٹپکا"],
    ["مور|VF1", "l", "لرز", "au", "مَوْرٌ"],
    ["نفذ|VF1", "l", "نکل بھاگ", "au", "نُفُوذٌ"],
    ["وري|VF4", "e", "سلگا"],
    ["وصي|VF6", "efl", "ایک دوسرے کو نصیحت کر"],
    // Para 28
    ["حيض|VF1", "l", "حیض آ", "ai", "حَيْضٌ"],
    ["خرب|VF4", "e", "برباد کر"],
    ["شكو|VF8", "ef", "شکایت کر"],
    ["ضيق|VF2", "e", "تنگ کر"],
    ["عبر|VF8", "ef", "عبرت پکڑ"],
    ["عدو|VF3", "ef", "دشمنی کر"],
    ["عسر|VF6", "efl", "آپس میں کشمکش کر"],
    ["عظم|VF4", "e", "بڑا کر"],
    ["غني|VF10", "l", "بے پروا ہو"],
    ["فرق|VF3", "e", "جدا کر"],
    ["فري|VF1", "e", "گھڑ", "ai", "فَرْيٌ"],
    ["فسح|VF1", "ef", "کشادگی پیدا کر", "aa", "فَسْحٌ"],
    ["فسح|VF5", "ef", "کشادگی پیدا کر"],
    ["لوي|VF2", "e", "موڑ"],
    ["مسس|VF6", "el", "ایک دوسرے کو چھو"],
    ["نجو|VF3", "ef", "سرگوشی کر"],
    ["نجو|VF6", "efl", "باہم سرگوشی کر"],
    ["نشز|VF1", "lx", "اٹھ", "au", "نُشُوزٌ"],
    ["وجف|VF4", "e", "دوڑا"],
    ["ودد|VF3", "ef", "محبت رکھ"],
    // Para 29
    ["أثر|VF1", "e", "نقل کر", "au", "أَثَارَةٌ"],
    ["بتل|VF5", "l", "منقطع ہو"],
    ["برق|VF1", "lx", "چندھیا", "ia", "بَرَقٌ"],
    ["بسر|VF1", "e", "منہ بسور", "au", "بُسُورٌ"],
    ["بصر|VF2", "e", "دکھا"],
    ["بقي|VF4", "e", "باقی رکھ"],
    ["ثني|VF10", "e", "استثناء کر"],
    ["حرك|VF2", "ef", "حرکت دے"],
    ["حري|VF1", "e", "قصد کر", "ai", "حَرْيٌ"],
    ["حري|VF5", "e", "ارادہ کر"],
    ["حضض|VF1", "ef", "ترغیب دے", "au", "حَضٌّ"],
    ["دبر|VF4", "ef", "پیٹھ پھیر"],
    ["دكك|VF1", "e", "توڑ", "au", "دَكٌّ"],
    ["دهن|VF4", "ef", "سستی کر"],
    ["رجف|VF1", "l", "کانپ", "au", "رَجْفَةٌ"],
    ["زلق|VF4", "e", "پھسلا"],
    ["سطر|VF1", "e", "لکھ", "au", "سَطْرٌ"],
    ["سفر|VF4", "l", "روشن ہو"],
    ["صرم|VF1", "e", "کاٹ", "ai", "صَرْمٌ"],
    ["صلي|VF2", "e", "جھونک"],
    ["عبس|VF1", "ef", "تیوری چڑھا", "ai", "عُبُوسٌ"],
    ["فرج|VF1", "e", "کھول", "au", "فَرْجٌ"],
    ["فكر|VF2", "e", "سوچ"],
    ["لفف|VF8", "lx", "لپٹ"],
    ["لوم|VF6", "efl", "آپس میں ملامت کر"],
    ["مطو|VF5", "l", "اکڑ"],
    ["مهد|VF2", "e", "بچھا"],
    ["مهل|VF2", "ef", "ڈھیل دے"],
    ["ميز|VF5", "lx", "پھٹ"],
    ["ندي|VF1", "e", "پکار", "au", "نَدْوٌ"],
    ["ندي|VF6", "el", "ایک دوسرے کو پکار"],
    ["نقر|VF1", "e", "پھونک", "au", "نَقْرٌ"],
    ["وسم|VF1", "e", "داغ دے", "ai", "وَسْمٌ"],
    ["وعي|VF1", "e", "یاد رکھ", "ai", "وَعْيٌ"],
    ["وعي|VF4", "e", "سمیٹ کر رکھ"],
    ["وفض|VF4", "l", "دوڑ"],
    ["وقت|VF2", "e", "وقت مقرر کر"],
    ["يسر|VF5", "l", "میسر آ"],
    // Para 30
    ["بعث|VF7", "lx", "اٹھ"],
    ["بعثر|VF1", "e", "کھول کر نکال"],
    ["تبب|VF1", "l", "ہلاک ہو", "ai", "تَبَابٌ"],
    ["ثوب|VF2", "e", "بدلہ دے"],
    ["جنب|VF2", "e", "بچا"],
    ["جنب|VF5", "e", "گریز کر"],
    ["جوب|VF1", "e", "تراش", "au", "جَوْبٌ"],
    ["حصل|VF2", "e", "حاصل کر"],
    ["حضض|VF6", "efl", "ایک دوسرے کو ترغیب دے"],
    ["حور|VF1", "l", "لوٹ", "au", "حَوْرٌ"],
    ["خلو|VF5", "l", "خالی ہو"],
    ["دحو|VF1", "e", "بچھا", "au", "دَحْوٌ"],
    ["دسو|VF1", "e", "دبا", "au", "دَسْوٌ"],
    ["دسو|VF2", "e", "دبا"],
    ["دمدم|VF1", "ef", "ہلاکت ڈال"],
    ["ردي|VF5", "lx", "گر"],
    ["رسو|VF4", "e", "گاڑ"],
    ["ركب|VF2", "e", "جوڑ"],
    ["رين|VF1", "l", "زنگ چڑھ", "ai", "رَيْنٌ"],
    ["زور|VF1", "ef", "زیارت کر", "au", "زِيَارَةٌ"],
    ["سجر|VF2", "e", "بھڑکا"],
    ["سجو|VF1", "e", "ڈھانپ", "au", "سُجُوٌّ"],
    ["سري|VF1", "l", "چل", "ai", "سُرًى"],
    ["سطح|VF1", "e", "بچھا", "aa", "سَطْحٌ"],
    ["سعر|VF2", "e", "بھڑکا"],
    ["سفع|VF1", "e", "گھسیٹ", "aa", "سَفْعٌ"],
    ["سمن|VF4", "e", "موٹا کر"],
    ["صدر|VF1", "l", "نکل", "au", "صُدُورٌ"],
    ["صدي|VF5", "ef", "فکر کر"],
    ["طحو|VF1", "e", "بچھا", "au", "طَحْوٌ"],
    ["عدد|VF2", "e", "گن گن کر رکھ"],
    ["عسعس|VF1", "l", "رخصت ہو"],
    ["عطل|VF2", "e", "چھوڑ"],
    ["غطش|VF4", "e", "ڈھانک"],
    ["غمز|VF6", "el", "آنکھیں مار"],
    ["فطر|VF7", "lx", "پھٹ"],
    ["قبر|VF4", "ef", "قبر دے"],
    ["قحم|VF8", "l", "گزر"],
    ["قرأ|VF4", "e", "پڑھوا"],
    ["قلي|VF1", "l", "ناراض ہو", "ai", "قِلًى"],
    ["قهر|VF1", "ef", "سختی کر", "aa", "قَهْرٌ"],
    ["كدر|VF7", "l", "گدلا ہو"],
    ["كشط|VF1", "ef", "کھال اتار", "aa", "كَشْطٌ"],
    ["كفر|VF4", "l", "منکر ہو"],
    ["لظي|VF1", "l", "بھڑک", "ia", "لَظًى"],
    ["لظي|VF5", "l", "بھڑک"],
    ["لهم|VF4", "e", "الہام کر"],
    ["لهو|VF1", "l", "غافل ہو", "au", "لَهْوٌ"],
    ["لهو|VF5", "ef", "بے رخی برت"],
    ["مهل|VF4", "ef", "ڈھیل دے"],
    ["نثر|VF8", "lx", "بکھر"],
    ["نحر|VF1", "ef", "قربانی کر", "aa", "نَحْرٌ"],
    ["نصب|VF1", "e", "نصب کر", "ai", "نَصْبٌ"],
    ["نعم|VF2", "ef", "نعمت دے"],
    ["نفس|VF5", "e", "سانس لے"],
    ["نفس|VF6", "l", "بازی لے جا"],
    ["نقض|VF4", "e", "توڑ"],
    ["وثق|VF4", "e", "باندھ"],
    ["ودع|VF2", "e", "چھوڑ"],
    ["وسط|VF1", "l", "جا گھس", "ai", "وَسْطٌ"],
    ["وسق|VF1", "e", "سمیٹ", "ai", "وَسْقٌ"],
    ["وسق|VF8", "l", "پورا ہو"],
    ["وفي|VF10", "e", "پورا پورا لے"],
    ["وقب|VF1", "l", "داخل ہو", "ai", "وُقُوبٌ"],
    // Second verbs of one root and باب, told apart by their vowels (pickVerb).
    ["حزن|VF1#2", "e", "غمگین کر", "au", "حُزْنٌ"],
    ["كبر|VF1#2", "l", "بھاری ہو", "uu", "كُبْرٌ"],
    ["حلل|VF1#2", "l", "اتر", "au", "حُلُولٌ"],
    ["صدد|VF1#2", "e", "شور مچا", "ai", "صَدِيدٌ"],
    ["لبس|VF1#2", "e", "پہن", "ia", "لُبْسٌ"],
    ["هوي|VF1#2", "l", "گر", "ai", "هُوِيٌّ"],
    ["فرق|VF1#2", "l", "ڈر", "ia", "فَرَقٌ"],
    ["بلو|VF1#2", "l", "پرانا ہو", "ia", "بِلًى"],
    ["بعد|VF1#2", "l", "ہلاک ہو", "ia", "بُعْدٌ"],
    ["قدم|VF1#2", "efl", "توجہ کر", "ia", "قُدُومٌ"],
    ["نصب|VF1#2", "ef", "محنت کر", "ia", "نَصَبٌ"]
  ];

  MORE.forEach(function (r) {
    var flags = r[1];
    var extra = r[5] || {};
    var v = derive(r[0], { vow: r[3] || "", m: r[4], amr: extra.amr, pc: extra.pc, cls: extra.cls, kw: extra.kw, l: /l/.test(flags), p: /p/.test(flags) });
    v.ur = r[2];
    v.erg = /e/.test(flags);
    v.f = /f/.test(flags);
    if (/x/.test(flags)) v.aux = "جا";
    if (extra.pu) v.pu = extra.pu;
    VERBS[r[0]] = v;
  });

  Object.keys(VERBS).forEach(function (k) {
    VERBS[k].six = VERBS[k].six.map(function (f) { return f && fixup(f); });
  });

  /** Verbs with no صرف to show: they never leave one form (لَيْسَ, نِعْمَ, بِئْسَ, عَسَى, هَاتِ, لَاتَ). */
  var JAMID = { "ليس|VF1": 1, "نعم|VF1": 1, "بأس|VF1": 1, "عسي|VF1": 1, "هات|VF1": 1, "لوت|VF1": 1 };

  /** "root|VF" for a verb segment of the corpus, as VERBS is keyed. */
  function verbKey(seg) {
    var vf = String(seg[6] || "").split(",").filter(function (f) { return /^VF\d+$/.test(f); })[0];
    return seg[5] && vf ? seg[5] + "|" + vf : "";
  }

  /**
   * A word with the Uthmani spelling evened out (ٱ, the small alif, hamza seats, ى) and the
   * sounds it takes from the words around it dropped, so two spellings of one form compare equal.
   */
  function normWord(w) {
    return w.normalize("NFC")
      .replace(/ـَٔا/g, "آ").replace(/ـ([\u064B-\u0652]*)ٔ/g, "ء$1").replace(/\u0640/g, "")
      .replace(/ىٰ/g, "ي").replace(/ى/g, "ي").replace(/ٱ/g, "ا")
      .replace(/َٰ/g, "َا").replace(/ٰ/g, "ا")
      .replace(/ۦ/g, "ي").replace(/ۥ/g, "و")
      .replace(/\u0622/g, "ا").replace(/[\u06D6-\u06ED\u0653]/g, "")
      .replace(/[أإؤئ]/g, "ء").replace(/ءَا/g, "ا")
      .replace(/ْ/g, "")
      .normalize("NFC")
      // Sounds that hang on the words around it: a letter doubled into the one before (رَّجَعَ),
      // a dropped hamzat wasl, د or ط run into ت (أَرَدتُّ), the vowel or و before a pronoun or
      // a pause (أَخَذَتِ, تُمُو, نَصَرُو), a final ي written short (يَأْتِ), and ى / ا at the end.
      .replace(/^ا[َُِ]?/, "")
      // تَتَفَعَّلُونَ is read تَفَعَّلُونَ with one ت dropped (تَلَقَّوْنَ, تَظَٰهَرُونَ).
      .replace(/^تَت/, "ت")
      .replace(/^(.[\u064B-\u0650]*)\u0651/, "$1")
      // ...or with the ت run into the next letter (يَزَّكَّىٰ, ٱطَّيَّرْنَا for يَتَزَكَّى, تَطَيَّرْنَا).
      .replace(/^([يتنأ]َ)?تَ/, "$1").replace(/^([يتنأ]َ)?(.[\u064B-\u0650]*)\u0651/, "$1$2")
      .replace(/([دطذ])ت([\u064B-\u0650]?)\u0651/g, "$1ت$2")
      .replace(/تُمُو?$/, "تُم").replace(/وُ?ا$/, "و").replace(/ُا$/, "ُ")
      .replace(/ِي$/, "ِ").replace(/[َُِ]$/, "").replace(/َ[اي]$/, "َي");
  }

  var SUFFIXED = {
    PERF: function (p) { return !/^3[MF]S$/.test(p); },
    IMPF: function (p) { return /D$|MP$|FP$|^2FS$/.test(p); }
  };

  /** The verb with its subject ending, as the corpus splits them: ءَامَنُ + وا۟. */
  function wordOf(segs, i) {
    var seg = segs[i];
    var next = segs[i + 1];
    var more = SUFFIXED[seg[3]] && SUFFIXED[seg[3]](pgnOf(seg)) && next && next[1] === 2 && next[3] === "PRON";
    return seg[0] + (more ? next[0] : "");
  }

  /** The form a verb takes for this segment's tense, person and voice. */
  function formFor(verb, seg, passive) {
    if (seg[3] === "IMPV") return verb.six[2];
    return table(verb, seg[3] === "PERF" ? "past" : "pres", passive && !!verb.pass)
      .filter(function (r) { return r.pgn === pgnOf(seg); })[0].ar;
  }

  var BY_ROOT = null;

  /**
   * Which verb a corpus verb segment is. A root and باب can hold two verbs (حَزِنَ يَحْزَنُ and
   * حَزَنَ يَحْزُنُ, لَبَسَ and لَبِسَ); the second is filed as "root|VF#2". The one whose form for
   * this tense and person shares the most letters and vowels with the word wins. When none of
   * them matches the word outright but a verb of another باب of the root does, the corpus has
   * tagged the باب wrong (تَمَنَّىٰ filed as ثلاثی), and that verb is the one.
   */
  function pickVerb(segs, i) {
    var seg = segs[i];
    var key = verbKey(seg);
    if (!VERBS[key]) return "";
    var target = normWord(wordOf(segs, i));
    var passive = String(seg[6] || "").split(",").indexOf("PASS") !== -1;
    var best = key;
    var bestScore = -1;
    for (var n = 1, k = key; VERBS[k]; k = key + "#" + ++n) {
      var ours = normWord(formFor(VERBS[k], seg, passive));
      if (ours === target) return k;
      var score = 0;
      while (score < ours.length && ours[score] === target[score]) score++;
      if (score > bestScore) { best = k; bestScore = score; }
    }
    if (!BY_ROOT) {
      BY_ROOT = {};
      Object.keys(VERBS).forEach(function (vk) { (BY_ROOT[vk.split("|")[0]] = BY_ROOT[vk.split("|")[0]] || []).push(vk); });
    }
    var other = (BY_ROOT[key.split("|")[0]] || []).filter(function (vk) {
      return vk.split("#")[0] !== key && normWord(formFor(VERBS[vk], seg, passive)) === target;
    })[0];
    return other || best;
  }

  /** The corpus writes a dual "you" without gender (2D); it is spelled like 2MD. */
  function pgnOf(seg) {
    return seg[4] === "2D" ? "2MD" : seg[4] || "";
  }

  var api = { PGN: PGN, verbs: VERBS, jamid: JAMID, verbKey: verbKey, pickVerb: pickVerb, normWord: normWord, wordOf: wordOf, pgnOf: pgnOf, table: table, sixUrdu: sixUrdu };
  global.MQ_SARF = api;
})(this);
