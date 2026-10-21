/** Fit the complete source photo within a bounded viewport; never crop faces. */
export function profilePhotoLayout(contentWidth: number, windowHeight: number, sourceWidth?: number, sourceHeight?: number) {
  const width = Math.max(1, contentWidth - 32);
  const validSource = typeof sourceWidth === 'number' && typeof sourceHeight === 'number' &&
    Number.isFinite(sourceWidth) && Number.isFinite(sourceHeight) && sourceWidth > 0 && sourceHeight > 0;
  const naturalHeight = validSource ? width * sourceHeight! / sourceWidth! : width * 1.1;
  const maxHeight = Math.max(180, Math.min(640, windowHeight * 0.6));
  return { width, height: Math.min(maxHeight, Math.max(180, naturalHeight)) };
}
