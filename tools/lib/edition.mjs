// Detects which edition of the 2021 Worlds Without Number PDF a file is.
import { lineText } from './pdftext.mjs';

/** Returns 'free', 'deluxe', or 'unknown'. */
export async function detectEdition(book) {
  const toc = await book.getPdfPage(3);
  const text = toc.cols.flat().map(lineText).join('\n');
  if (!/Worlds Without Number|Creating Your Campaign/i.test(text) && !/Table of Contents/i.test(text)) return 'unknown';
  if (/Additional GM Tools/i.test(text) && /Legates/i.test(text)) return 'deluxe';
  if (/Factions and Major Projects/i.test(text)) return 'free';
  return 'unknown';
}
