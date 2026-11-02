// Dev helper: prints book pages as marked-up text. Usage: node tools/dump-pages.mjs <pdf> <from> <to>
import { openBook, lineMarkup } from './lib/pdftext.mjs';
const [, , pdf, from, to = from] = process.argv;
const book = await openBook(pdf);
for (let p = +from; p <= +to; p++) {
  const pg = await book.getPage(p);
  console.log(`\n===== BOOK PAGE ${p} =====`);
  pg.cols.forEach((col, i) => {
    console.log(`--- col ${i} ---`);
    for (const l of col) console.log(`[${Math.round(l.x)}] ${lineMarkup(l)}`);
  });
}
