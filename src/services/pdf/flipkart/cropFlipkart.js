import { loadPdf, save } from '../common/loadPdf.js';
import { AppError } from '../../../utils/AppError.js';

/**
 * Flipkart auto-crop. Uses ONLY the Flipkart preset passed in (x, y, width, height in PDF points,
 * measured from the bottom-left corner of each page). Kept separate from the other
 * marketplace modules on purpose, so changing one never affects another.
 */
export async function cropFlipkart(buffer, preset, name) {
  const doc = await loadPdf(buffer, name);
  const pages = doc.getPages();
  pages.forEach((page, i) => {
    const mb = page.getMediaBox();
    const x = mb.x + preset.x;
    const y = mb.y + preset.y;
    const w = Math.min(preset.width, mb.width - preset.x);
    const h = Math.min(preset.height, mb.height - preset.y);
    if (w <= 1 || h <= 1) throw new AppError(`The Flipkart crop area is outside page ${i + 1}. Please adjust the preset in Settings.`, 422);
    page.setCropBox(x, y, w, h);
    page.setMediaBox(x, y, w, h);
  });
  return { buffer: await save(doc), pagesIn: pages.length, pagesOut: pages.length };
}
