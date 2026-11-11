/**
 * An age as a band, for a de-identified pedigree (pedigree-editor-generation-numbering): "infant"
 * under 1, "child" from 1 to 9, "teen" from 10 to 19, then the decade ("20s", "30s", ...).
 * Ages are whole years at the last birthday, to `death` if given, otherwise to `today`.
 *
 * @return the band, or null with no birth date (or a birth after the end date)
 */
export function ageBand(birth: Date | null, death: Date | null, today: Date = new Date()): string | null {
  if (!birth || isNaN(birth.getTime())) {
    return null;
  }
  const end = death && !isNaN(death.getTime()) ? death : today;
  if (end < birth) {
    return null;
  }
  let years = end.getFullYear() - birth.getFullYear();
  if (end.getMonth() < birth.getMonth() || (end.getMonth() === birth.getMonth() && end.getDate() < birth.getDate())) {
    years--;
  }
  if (years < 1) {
    return 'infant';
  }
  if (years < 10) {
    return 'child';
  }
  if (years < 20) {
    return 'teen';
  }
  return (Math.floor(years / 10) * 10) + 's';
}

/**
 * A person's de-identified age label: their band, or for someone deceased "d. " and their band at
 * death ("d." alone without both dates: their age at death isn't known), or null when there's
 * nothing to show.
 */
export function deidentifiedAgeLabel(birth: Date | null, death: Date | null, deceased: boolean, today: Date = new Date()): string | null {
  if (deceased) {
    const band = death ? ageBand(birth, death, today) : null;
    return band ? 'd. ' + band : 'd.';
  }
  return ageBand(birth, null, today);
}
