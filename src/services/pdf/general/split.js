import archiver from 'archiver';
import { loadPdf, newDocWithPages, save } from '../common/loadPdf.js';
import { parseRanges } from '../../../utils/pageRanges.js';

/** One PDF per page range, returned as a ZIP buffer. */
export async function splitPdf(buffer, rangesInput, baseName, name) {
  const src = await loadPdf(buffer, name);
  const total = src.getPageCount();
  const groups = parseRanges(rangesInput, total);
  const parts = [];
  for (let i = 0; i < groups.length; i++) {
    parts.push({ name: `${baseName}-part${i + 1}.pdf`, data: await save(await newDocWithPages(src, groups[i])) });
  }
  const zip = await new Promise((resolve, reject) => {
    const chunks = [];
    const a = archiver('zip', { zlib: { level: 6 } });
    a.on('data', (c) => chunks.push(c));
    a.on('end', () => resolve(Buffer.concat(chunks)));
    a.on('error', reject);
    parts.forEach((p) => a.append(p.data, { name: p.name }));
    a.finalize();
  });
  return { buffer: zip, pagesIn: total, pagesOut: groups.reduce((n, g) => n + g.length, 0), count: parts.length };
}
