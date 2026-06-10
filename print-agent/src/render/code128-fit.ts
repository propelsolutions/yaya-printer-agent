/** Conservative Code 128 module estimate (start + data + checksum + stop). */
export function estimateCode128Modules(data: string): number {
  return 35 + data.length * 11;
}

export function estimateCode128WidthDots(
  data: string,
  narrowBarWidth: number,
): number {
  return estimateCode128Modules(data) * narrowBarWidth;
}

export function fitCode128NarrowBarWidth(
  data: string,
  maxWidthDots: number,
  preferredNarrow = 2,
  preferredWide = 5,
): { narrow: number; wide: number } {
  const modules = estimateCode128Modules(data);
  const narrow = Math.max(
    1,
    Math.min(preferredNarrow, Math.floor(maxWidthDots / modules)),
  );
  const wide = Math.max(
    narrow + 1,
    Math.min(preferredWide, Math.round(narrow * 2.5)),
  );

  return { narrow, wide };
}

export function fitCode128RenderScale(
  data: string,
  maxWidthPx: number,
  preferredScale = 3,
): number {
  const modules = estimateCode128Modules(data);
  return Math.max(1, Math.min(preferredScale, Math.floor(maxWidthPx / modules)));
}
