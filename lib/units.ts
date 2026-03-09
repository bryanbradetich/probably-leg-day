/**
 * Unit conversion and formatting for weight (kg <-> lbs) and length (cm <-> in).
 */

const KG_TO_LBS = 2.20462;
const CM_PER_INCH = 2.54;

export function kgToLbs(kg: number | null | undefined): number | null {
  if (kg == null || Number.isNaN(kg)) return null;
  return Math.round(kg * KG_TO_LBS * 10) / 10;
}

export function lbsToKg(lbs: number | null | undefined): number | null {
  if (lbs == null || Number.isNaN(lbs)) return null;
  return Math.round((lbs / KG_TO_LBS) * 1000) / 1000;
}

export function formatWeight(
  kg: number | null | undefined,
  options?: { inLbs?: boolean }
): string {
  if (kg == null || Number.isNaN(kg)) return "—";
  if (options?.inLbs) {
    const lbs = kgToLbs(kg);
    return lbs != null ? `${lbs} lb` : "—";
  }
  return `${kg} kg`;
}

export function cmToInches(cm: number | null | undefined): number | null {
  if (cm == null || Number.isNaN(cm)) return null;
  return Math.round((cm / CM_PER_INCH) * 10) / 10;
}

export function inchesToCm(inches: number | null | undefined): number | null {
  if (inches == null || Number.isNaN(inches)) return null;
  return Math.round(inches * CM_PER_INCH * 10) / 10;
}
