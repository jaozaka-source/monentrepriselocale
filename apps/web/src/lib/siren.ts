/**
 * SIREN validation and EU VAT number calculation.
 *
 * The SIREN is a 9-digit French company identifier. Its last digit is a Luhn
 * checksum over the first 8 digits, computed with the "double every other
 * digit starting from the left" variant used by INSEE.
 */

/** Removes all non-digit characters. */
export function sanitizeSiren(input: string): string {
  return (input || '').replace(/\D/g, '');
}

/** True when the value is exactly 9 digits. */
export function isSirenFormat(input: string): boolean {
  return /^\d{9}$/.test(sanitizeSiren(input));
}

/**
 * Luhn validation of a 9-digit SIREN (INSEE algorithm).
 *
 * The SIREN uses the standard Luhn checksum: starting from the rightmost
 * digit (the check digit, not doubled), every second digit moving left is
 * doubled; if the result exceeds 9, its digits are summed. The total modulo
 * 10 must be 0. For a 9-digit (odd-length) number this means the digits at
 * odd 0-indexed positions from the left (1, 3, 5, 7) are the ones doubled.
 */
export function isSirenValid(input: string): boolean {
  const siren = sanitizeSiren(input);
  if (!/^\d{9}$/.test(siren)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let digit = Number(siren[i]);
    // For a 9-digit number, Luhn doubles digits at odd 0-indexed positions
    // (the 2nd, 4th, 6th, 8th counting from the right).
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }

  return sum % 10 === 0;
}

/**
 * Computes the EU VAT number (numéro de TVA intracommunautaire) from a SIREN:
 *   FR + key + SIREN, where key = (12 + 3 × (SIREN mod 97)) mod 97, on 2 digits.
 */
export function computeVatNumber(input: string): string {
  const siren = sanitizeSiren(input);
  if (!/^\d{9}$/.test(siren)) return '';

  const sirenNum = Number(siren);
  const key = (12 + 3 * (sirenNum % 97)) % 97;
  const keyStr = key < 10 ? `0${key}` : String(key);

  return `FR${keyStr}${siren}`;
}
