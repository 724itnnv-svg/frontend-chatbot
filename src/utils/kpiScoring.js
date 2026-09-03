function numberFromText(value) {
  const match = String(value ?? "").replace(/,/g, ".").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : Number.NaN;
}

function optionalNumber(value, fallback) {
  if (value === "" || value == null) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function roundScore(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function comparisonMatches(actual, comparison, threshold) {
  if (comparison === "LTE") return actual <= threshold;
  if (comparison === "LT") return actual < threshold;
  if (comparison === "GT") return actual > threshold;
  return actual >= threshold;
}

function fixedScoreCapFromNote(item) {
  const match = String(item.criteriaNote || "")
    .replace(/,/g, ".")
    .match(/(?:không\s*vượt\s*quá|tối\s*đa)\s*(\d+(?:\.\d+)?)\s*điểm/i);
  return match ? Number(match[1]) : null;
}

function hasLegacyBonusRule(item) {
  const note = String(item.criteriaNote || "").replace(/,/g, ".");
  return /[-±+]\s*\d+(?:\.\d+)?\s*%?\s*(?:tương\s*đương|=)\s*\+?\s*\d+(?:\.\d+)?\s*điểm/i.test(note)
    || /thêm\s*\d+(?:\.\d+)?[^+\d]*\+\s*\d+(?:\.\d+)?\s*điểm/i.test(note);
}

export function resolveScoreCap(item, base = Number(item.standardScore || item.weight || 0)) {
  if (item.scoreCapMode === "unlimited") return { mode: "unlimited", maxScore: null };
  if (item.scoreCapMode === "fixed_score") {
    return { mode: "fixed_score", maxScore: Math.max(0, optionalNumber(item.maxScore, base)) };
  }
  if (item.scoreCapMode === "standard_score") return { mode: "standard_score", maxScore: base };
  if (item.isScoreUnlimited === true || /không\s*giới\s*hạn/i.test(String(item.criteriaNote || ""))) {
    return { mode: "unlimited", maxScore: null };
  }
  const noteCap = fixedScoreCapFromNote(item);
  if (noteCap != null) return { mode: "fixed_score", maxScore: noteCap };
  if (hasLegacyBonusRule(item)) return { mode: "fixed_score", maxScore: 300 };
  return { mode: "standard_score", maxScore: base };
}

export function isUnlimitedScore(item) {
  return resolveScoreCap(item).mode === "unlimited";
}

function boundScore(item, value, base) {
  const nonNegative = Math.max(0, Number(value) || 0);
  const cap = resolveScoreCap(item, base);
  return cap.mode === "unlimited" ? nonNegative : Math.min(cap.maxScore, nonNegative);
}

function structuredBoundScore(item, value, base) {
  const minimum = Math.max(-1000000, optionalNumber(item.minimumScore, 0));
  const score = Math.max(minimum, Number(value) || 0);
  const cap = resolveScoreCap(item, base);
  return cap.mode === "unlimited" ? score : Math.min(cap.maxScore, score);
}

function structuredPointScore(item, actualText) {
  const actual = numberFromText(actualText);
  if (!Number.isFinite(actual)) return 0;
  const base = Number(item.standardScore || item.weight || 0);
  const formulaType = String(item.formulaType || "proportional");
  if (formulaType === "threshold") {
    const threshold = optionalNumber(item.thresholdValue, Number.NaN);
    if (!Number.isFinite(threshold)) return 0;
    const passed = comparisonMatches(actual, item.comparison, threshold);
    return roundScore(structuredBoundScore(
      item,
      passed ? optionalNumber(item.passScore, base) : optionalNumber(item.failScore, 0),
      base,
    ));
  }
  const target = optionalNumber(item.targetValue, 0);
  if (formulaType === "proportional") {
    return target > 0 ? roundScore(structuredBoundScore(item, actual / target * base, base)) : 0;
  }
  const step = optionalNumber(item.stepValue, 1);
  const points = optionalNumber(item.pointsPerStep, 0);
  if (!(step > 0) || points < 0) return 0;
  if (formulaType === "unit_add") return roundScore(structuredBoundScore(item, base + Math.max(0, actual - target) * points / step, base));
  if (formulaType === "unit_deduct") return roundScore(structuredBoundScore(item, base - Math.max(0, actual - target) * points / step, base));
  if (formulaType === "signed_delta") return roundScore(structuredBoundScore(item, base + actual * points / step, base));
  return 0;
}

function thresholdScore(item, actual, base) {
  const threshold = optionalNumber(item.thresholdValue, Number.NaN);
  if (!Number.isFinite(threshold)) return 0;
  const passed = comparisonMatches(actual, item.comparison, threshold);
  const passScore = optionalNumber(item.passScore, base);
  const failScore = optionalNumber(item.failScore, 0);
  return boundScore(item, passed ? passScore : failScore, base);
}

function legacyZeroScoreThreshold(item, actual, base) {
  const match = String(item.criteriaNote || "")
    .replace(/,/g, ".")
    .match(/(<=|>=|<|>|≤|≥)\s*(-?\d+(?:\.\d+)?)\s*%?[\s\S]{0,80}?0\s*điểm/i);
  if (!match) return null;
  const comparison = ({ "<": "LT", "<=": "LTE", "≤": "LTE", ">": "GT", ">=": "GTE", "≥": "GTE" })[match[1]];
  return comparisonMatches(actual, comparison, Number(match[2])) ? 0 : base;
}

export function standardPointScore(item, actualText = item.employeeActualText) {
  if (item.scoringVersion === "structured_v2") return structuredPointScore(item, actualText);
  const actual = numberFromText(actualText);
  const base = Number(item.standardScore || item.weight || 0);

  if (item.scoringType === "threshold") {
    return Number.isFinite(actual) ? thresholdScore(item, actual, base) : 0;
  }
  if (Number.isFinite(actual)) {
    const legacyScore = legacyZeroScoreThreshold(item, actual, base);
    if (legacyScore != null) return legacyScore;
  }

  const target = numberFromText(item.standardQuantity);
  if (!String(item.standardQuantity || "").trim() || !Number.isFinite(target)) {
    return String(actualText ?? "").trim() ? base : 0;
  }
  if (!Number.isFinite(actual)) return 0;
  const note = String(item.criteriaNote || "");
  const penaltyRule = note.replace(/,/g, ".").match(/(?:mỗi\s*)?(\d+(?:\.\d+)?)\s*(?:sự\s*cố|lỗi|lần|vi\s*phạm|trường\s*hợp)[\s\S]{0,160}?(?:bị|trừ|=)\s*-?\s*(\d+(?:\.\d+)?)\s*điểm/i);
  if (penaltyRule) {
    const excess = Math.max(0, actual - target);
    return boundScore(item, base - excess * Number(penaltyRule[2]) / Number(penaltyRule[1]), base);
  }
  if (target === 0) return base;
  const lowerIsBetter = /(không\s*quá|tối\s*đa|≤|<=|nhỏ\s*hơn)/i.test(item.standardQuantity);
  const rateRule = note.replace(/,/g, ".").match(/[±+-]\s*(\d+(?:\.\d+)?)\s*%?\s*(?:tương\s*đương|=)\s*\+?\s*(\d+(?:\.\d+)?)\s*điểm/i);
  if (rateRule) {
    const direction = lowerIsBetter ? -1 : 1;
    return boundScore(item, base + direction * (actual - target) * Number(rateRule[2]) / Number(rateRule[1]), base);
  }
  const bonusRule = note.replace(/,/g, ".").match(/thêm\s*(\d+(?:\.\d+)?)[^+\d]*\+\s*(\d+(?:\.\d+)?)\s*điểm/i);
  if (bonusRule) return boundScore(item, base + (actual - target) * Number(bonusRule[2]) / Number(bonusRule[1]), base);
  if (lowerIsBetter) return actual <= target ? base : Math.max(0, base * target / actual);
  return boundScore(item, actual / target * base, base);
}
