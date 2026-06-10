/** Strip UI-only prefixes (#, *) before printing or barcode encoding. */
export function printableEntityCode(value: string): string {
  return value.trim().replace(/^[#*]+/, "");
}
