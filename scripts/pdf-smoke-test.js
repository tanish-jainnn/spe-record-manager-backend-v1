// Verifies the PDF services with generated sample PDFs (no database needed).
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { cropFlipkart } from '../src/services/pdf/flipkart/cropFlipkart.js';
import { cropSnapdeal } from '../src/services/pdf/snapdeal/cropSnapdeal.js';
import { removeAmazonPages } from '../src/services/pdf/amazon/removeAmazonPages.js';
import { mergePdfs } from '../src/services/pdf/general/merge.js';
import { splitPdf } from '../src/services/pdf/general/split.js';
import { removePages } from '../src/services/pdf/general/removePages.js';
import { reorderPdf } from '../src/services/pdf/general/reorder.js';

async function sample(n) {
  const d = await PDFDocument.create();
  for (let i = 1; i <= n; i++) d.addPage([595, 842]).drawText(`Page ${i}`, { x: 50, y: 700, size: 30 });
  return Buffer.from(await d.save());
}
const pages = async (b) => (await PDFDocument.load(b)).getPageCount();

const src = await sample(5);
const preset = { x: 10, y: 420, width: 500, height: 400 };

let r = await cropFlipkart(src, preset, 't.pdf');
let box = (await PDFDocument.load(r.buffer)).getPage(0).getCropBox();
assert.deepEqual([box.x, box.y, box.width, box.height], [10, 420, 500, 400]);
assert.equal(r.pagesOut, 5);

r = await cropSnapdeal(src, { x: 0, y: 0, width: 300, height: 300 }, 't.pdf');
box = (await PDFDocument.load(r.buffer)).getPage(2).getCropBox();
assert.deepEqual([box.width, box.height], [300, 300]);

assert.equal(await pages((await removeAmazonPages(src, '2,4-5', 't.pdf')).buffer), 2);
assert.equal(await pages((await removePages(src, [1], 't.pdf')).buffer), 4);
assert.equal(await pages((await mergePdfs([{ buffer: src, originalname: 'a.pdf' }, { buffer: await sample(2), originalname: 'b.pdf' }])).buffer), 7);
const s = await splitPdf(src, '1-2,3-5', 'doc', 't.pdf');
assert.equal(s.count, 2);
assert.equal(s.buffer.subarray(0, 2).toString(), 'PK');
assert.equal(await pages((await reorderPdf(src, '5,4,3,2,1', 't.pdf')).buffer), 5);

await assert.rejects(removeAmazonPages(src, '1-5', 't.pdf'), /every page/);
await assert.rejects(removePages(src, '9', 't.pdf'), /between 1 and 5/);
await assert.rejects(reorderPdf(src, '1,2,3', 't.pdf'), /every page/);
await assert.rejects(cropFlipkart(Buffer.from('not a pdf'), preset, 'bad.pdf'), /corrupt/);
console.log('All PDF checks passed.');
