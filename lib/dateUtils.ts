export function toBengaliDigits(
  num: number | string | null | undefined
): string {
  if (num === null || num === undefined) return "";
  const bn = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(num)
    .split("")
    .map((d) => (/\d/.test(d) ? bn[Number(d)] : d))
    .join("");
}

export function formatSingleDate(
  dateStr: string | null | undefined,
  isBengaliEra = false
): string {
  if (!dateStr || !dateStr.trim()) return "";
  const trimmed = dateStr.trim();

  // If YYYY-MM-DD
  const dateParts = trimmed.split("-");
  if (dateParts.length === 3 && dateParts[0].length === 4) {
    const [y, m, d] = dateParts;
    const formatted = `${toBengaliDigits(d)}/${toBengaliDigits(m)}/${toBengaliDigits(y)}`;
    return isBengaliEra ? `${formatted} বঙ্গাব্দ` : `${formatted} খ্রি.`;
  }

  // If standard string or just a year
  const bnDigits = toBengaliDigits(trimmed);
  return isBengaliEra ? `${bnDigits} বঙ্গাব্দ` : `${bnDigits} খ্রি.`;
}

export interface FormattedLifeDates {
  birthText: string | null;
  deathText: string | null;
  lifeSpanSummary: string | null;
}

export function formatLifeDates(params: {
  birthDateAd?: string | null;
  birthDateBs?: string | null;
  deathDateAd?: string | null;
  isAlive?: boolean;
}): FormattedLifeDates {
  const { birthDateAd, birthDateBs, deathDateAd } = params;

  const adBirth = formatSingleDate(birthDateAd, false);
  const bsBirth = formatSingleDate(birthDateBs, true);

  let birthText: string | null = null;
  if (adBirth && bsBirth) {
    birthText = `${adBirth} (${bsBirth})`;
  } else if (adBirth) {
    birthText = adBirth;
  } else if (bsBirth) {
    birthText = bsBirth;
  }

  const deathText = formatSingleDate(deathDateAd, false) || null;

  let lifeSpanSummary: string | null = null;
  if (birthText && deathText) {
    lifeSpanSummary = `${birthText} — ${deathText}`;
  } else if (birthText) {
    lifeSpanSummary = `জন্ম: ${birthText}`;
  } else if (deathText) {
    lifeSpanSummary = `মৃত্যু: ${deathText}`;
  }

  return {
    birthText,
    deathText,
    lifeSpanSummary,
  };
}
