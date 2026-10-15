/**
 * Server-side HTML → pdf-lib renderer.
 *
 * Renders a subset of HTML (div, h1-h3, p, strong/b, em/i, ul, ol, li,
 * table/thead/tbody/tr/th/td, br) with inline styles (font-size, text-align,
 * color, background, margin, padding, width, border, page-break-before) into
 * a pdf-lib document. Used to render the contract cadre template body.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { parse, type HTMLElement } from 'node-html-parser';

export const PAGE_W = 595.28;
export const PAGE_H = 841.89;
const MARGIN = 48;

type Rgb = { r: number; g: number; b: number };
const BLACK: Rgb = { r: 0.1, g: 0.16, b: 0.24 };
const GREY_BG: Rgb = { r: 0.933, g: 0.933, b: 0.933 };
const BORDER: Rgb = { r: 0.6, g: 0.6, b: 0.6 };

function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

type Style = {
  fontSize: number;
  align: 'left' | 'center' | 'right';
  color: Rgb;
  bg: Rgb | null;
  bold: boolean;
  italic: boolean;
  margin: [number, number, number, number]; // top right bottom left
  padding: [number, number]; // vert horiz
  widthPct: number | null;
  border: boolean;
  pageBreak: boolean;
  valign: 'top' | 'middle';
};

function parseStyle(raw: string | undefined, inherited: Partial<Style> = {}): Style {
  const s: Style = {
    fontSize: inherited.fontSize ?? 10,
    align: inherited.align ?? 'left',
    color: inherited.color ?? BLACK,
    bg: null,
    bold: inherited.bold ?? false,
    italic: inherited.italic ?? false,
    margin: [0, 0, 0, 0],
    padding: [0, 0],
    widthPct: null,
    border: false,
    pageBreak: false,
    valign: 'top',
  };
  if (!raw) return s;
  for (const decl of raw.split(';')) {
    const idx = decl.indexOf(':');
    if (idx < 0) continue;
    const key = decl.slice(0, idx).trim().toLowerCase();
    const val = decl.slice(idx + 1).trim();
    if (key === 'font-size') {
      const n = parseFloat(val);
      if (!Number.isNaN(n)) s.fontSize = n;
    } else if (key === 'text-align') {
      s.align = (val as 'left' | 'center' | 'right');
    } else if (key === 'color') {
      const c = hexToRgb(val);
      if (c) s.color = c;
    } else if (key === 'background' || key === 'background-color') {
      const c = hexToRgb(val);
      if (c) s.bg = c;
    } else if (key === 'font-weight') {
      s.bold = val === 'bold' || val === '700' || val === '800';
    } else if (key === 'font-style') {
      s.italic = val === 'italic';
    } else if (key === 'text-align') {
      s.align = (val as 'left' | 'center' | 'right');
    } else if (key === 'margin') {
      const parts = val.split(/\s+/).map((p) => parseFloat(p) || 0);
      if (parts.length === 1) s.margin = [parts[0], parts[0], parts[0], parts[0]];
      else if (parts.length === 2) s.margin = [parts[0], parts[1], parts[0], parts[1]];
      else if (parts.length === 4) s.margin = [parts[0], parts[1], parts[2], parts[3]];
    } else if (key === 'padding') {
      const parts = val.split(/\s+/).map((p) => parseFloat(p) || 0);
      if (parts.length === 1) s.padding = [parts[0], parts[0]];
      else if (parts.length >= 2) s.padding = [parts[0], parts[1]];
    } else if (key === 'width') {
      const m = /^([\d.]+)%$/.exec(val);
      if (m) s.widthPct = parseFloat(m[1]) / 100;
    } else if (key === 'border') {
      s.border = /solid|dashed|dotted/.test(val);
    } else if (key === 'page-break-before') {
      s.pageBreak = val === 'always';
    } else if (key === 'vertical-align') {
      s.valign = (val as 'top' | 'middle');
    }
  }
  return s;
}

type Run = { text: string; font: PDFFont; size: number; color: Rgb };

class Writer {
  doc: PDFDocument;
  fonts!: { reg: PDFFont; bold: PDFFont; italic: PDFFont; boldItalic: PDFFont };
  page: PDFPage;
  y: number;

  constructor(doc: PDFDocument) {
    this.doc = doc;
    this.page = doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }

  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }

  ensure(needed: number) {
    if (this.y - needed < MARGIN) this.newPage();
  }

  fontFor(bold: boolean, italic: boolean): PDFFont {
    if (bold && italic) return this.fonts.boldItalic;
    if (bold) return this.fonts.bold;
    if (italic) return this.fonts.italic;
    return this.fonts.reg;
  }
}

/** node-html-parser types childNodes as Node[]; cast to HTMLElement[] for access. */
function children(node: HTMLElement): HTMLElement[] {
  return node.childNodes as unknown as HTMLElement[];
}

function pdfSafe(s: string): string {
  return (s || '')
    .replace(/€/g, ' EUR')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/ᵉ/g, 'e')
    .replace(/ʳ/g, 'r')
    .replace(/ʰ/g, 'h')
    .replace(/ˢ/g, 's')
    .replace(/ᵗ/g, 't')
    .replace(/[^\x0A\x0D\x20-\x7E\xA0-\xFF]/g, ' ');
}

/** Splits inline content into styled words and wraps them into lines. */
function layoutInline(
  writer: Writer,
  node: HTMLElement,
  inherited: Style,
  maxWidth: number,
): { lines: Run[][]; height: number } {
  const runs: Run[] = [];
  const collect = (n: HTMLElement, style: Style) => {
    for (const child of children(n)) {
      if (child.nodeType === 3) {
        const text = pdfSafe((child as unknown as { text: string }).text || '');
        if (text) runs.push({ text, font: writer.fontFor(style.bold, style.italic), size: style.fontSize, color: style.color });
      } else if (child.tagName) {
        const tag = child.tagName.toLowerCase();
        const cs = parseStyle((child as HTMLElement).attributes?.style, style);
        if (tag === 'br') {
          runs.push({ text: '\n', font: writer.fontFor(style.bold, style.italic), size: style.fontSize, color: style.color });
          continue;
        }
        const childStyle: Style = {
          ...style,
          fontSize: cs.fontSize || style.fontSize,
          align: style.align,
          color: cs.color,
          bold: style.bold || cs.bold,
          italic: style.italic || cs.italic,
        };
        collect(child as HTMLElement, childStyle);
      }
    }
  };
  collect(node, inherited);

  // Split runs into words, preserving explicit newlines.
  const words: Run[] = [];
  for (const run of runs) {
    if (run.text === '\n') {
      words.push(run);
      continue;
    }
    const parts = run.text.split(/(\s+)/);
    for (const p of parts) {
      if (p === '') continue;
      if (/^\s+$/.test(p)) {
        // collapse to a single space word
        if (words.length && words[words.length - 1].text !== '\n' && !/^\s+$/.test(words[words.length - 1].text)) {
          words.push({ text: ' ', font: run.font, size: run.size, color: run.color });
        }
      } else {
        words.push({ text: p, font: run.font, size: run.size, color: run.color });
      }
    }
  }

  const lines: Run[][] = [];
  let line: Run[] = [];
  let lineWidth = 0;
  const spaceW = (r: Run) => r.font.widthOfTextAtSize(' ', r.size);

  const flush = () => {
    if (line.length && line[line.length - 1].text === ' ') line.pop();
    lines.push(line);
    line = [];
    lineWidth = 0;
  };

  for (const w of words) {
    if (w.text === '\n') {
      flush();
      continue;
    }
    const ww = w.font.widthOfTextAtSize(w.text, w.size);
    const extra = line.length ? spaceW(w) : 0;
    if (line.length && lineWidth + extra + ww > maxWidth) flush();
    if (w.text === ' ') {
      if (line.length) {
        line.push(w);
        lineWidth += spaceW(w);
      }
      continue;
    }
    line.push({ ...w, text: w.text });
    lineWidth += (line.length > 1 ? spaceW(w) : 0) + ww;
  }
  if (line.length) flush();

  const lineHeight = inherited.fontSize * 1.4;
  return { lines, height: Math.max(lines.length, 1) * lineHeight };
}

function drawLines(writer: Writer, lines: Run[][], x: number, width: number, align: Style['align'], lineHeight: number) {
  for (const line of lines) {
    if (!line.length) {
      writer.y -= lineHeight;
      continue;
    }
    let lineW = 0;
    for (let i = 0; i < line.length; i += 1) {
      const w = line[i];
      lineW += w.font.widthOfTextAtSize(w.text, w.size);
      if (i > 0) lineW += w.font.widthOfTextAtSize(' ', w.size);
    }
    let cx = x;
    if (align === 'center') cx = x + (width - lineW) / 2;
    else if (align === 'right') cx = x + (width - lineW);
    writer.ensure(lineHeight);
    for (let i = 0; i < line.length; i += 1) {
      const w = line[i];
      if (i > 0) cx += w.font.widthOfTextAtSize(' ', w.size);
      writer.page.drawText(w.text, { x: cx, y: writer.y - lineHeight + 2, size: w.size, font: w.font, color: rgb(w.color.r, w.color.g, w.color.b) });
      cx += w.font.widthOfTextAtSize(w.text, w.size);
    }
    writer.y -= lineHeight;
  }
}

function renderBlock(writer: Writer, node: HTMLElement, inherited: Style, contentWidth: number) {
  const tag = node.tagName.toLowerCase();
  const style = parseStyle(node.attributes?.style, inherited);

  if (style.pageBreak) writer.newPage();

  if (tag === 'table') {
    renderTable(writer, node, style, contentWidth);
    writer.y -= style.margin[2];
    return;
  }
  if (tag === 'ul' || tag === 'ol') {
    renderList(writer, node, style, contentWidth, tag === 'ol');
    writer.y -= style.margin[2];
    return;
  }
  // Container elements recurse into their children.
  if (tag === 'div' || tag === 'section' || tag === 'article' || tag === 'main') {
    writer.y -= style.margin[0];
    renderChildren(writer, node, { ...inherited, fontSize: style.fontSize, color: style.color, align: style.align }, contentWidth);
    writer.y -= style.margin[2];
    return;
  }

  // heading / paragraph / div / li
  let size = style.fontSize;
  if (tag === 'h1') size = style.fontSize || 18;
  else if (tag === 'h2') size = style.fontSize || 13;
  else if (tag === 'h3') size = style.fontSize || 12;
  const blockStyle: Style = { ...style, fontSize: size };
  const lineHeight = size * 1.4;

  writer.y -= style.margin[0];
  const { lines } = layoutInline(writer, node, blockStyle, contentWidth);
  drawLines(writer, lines, MARGIN, contentWidth, style.align, lineHeight);
  writer.y -= style.margin[2];
}

function renderList(writer: Writer, node: HTMLElement, style: Style, contentWidth: number, ordered: boolean) {
  writer.y -= style.margin[0];
  let i = 1;
  for (const child of children(node)) {
    if (child.nodeType !== 1 || child.tagName.toLowerCase() !== 'li') continue;
    const li = child as HTMLElement;
    const liStyle = parseStyle(li.attributes?.style, style);
    const marker = ordered ? `${i}.` : '•';
    const markerFont = writer.fontFor(false, false);
    const markerW = markerFont.widthOfTextAtSize(marker + '  ', liStyle.fontSize);
    const { lines } = layoutInline(writer, li, liStyle, contentWidth - markerW);
    const lineHeight = liStyle.fontSize * 1.4;
    for (let li2 = 0; li2 < lines.length; li2 += 1) {
      writer.ensure(lineHeight);
      if (li2 === 0) {
        writer.page.drawText(marker, { x: MARGIN, y: writer.y - lineHeight + 2, size: liStyle.fontSize, font: markerFont, color: rgb(BLACK.r, BLACK.g, BLACK.b) });
      }
      const line = lines[li2];
      let cx = MARGIN + markerW;
      for (let k = 0; k < line.length; k += 1) {
        const w = line[k];
        if (k > 0) cx += w.font.widthOfTextAtSize(' ', w.size);
        writer.page.drawText(w.text, { x: cx, y: writer.y - lineHeight + 2, size: w.size, font: w.font, color: rgb(w.color.r, w.color.g, w.color.b) });
        cx += w.font.widthOfTextAtSize(w.text, w.size);
      }
      writer.y -= lineHeight;
    }
    i += 1;
  }
  writer.y -= style.margin[2];
}

function renderTable(writer: Writer, node: HTMLElement, style: Style, contentWidth: number) {
  writer.y -= style.margin[0];
  const tableW = contentWidth;
  // Collect rows (from thead + tbody, or direct tr).
  const rows: HTMLElement[] = [];
  const collectRows = (parent: HTMLElement) => {
    for (const child of parent.childNodes) {
      if (child.nodeType !== 1) continue;
      const t = (child as HTMLElement).tagName.toLowerCase();
      if (t === 'tr') rows.push(child as HTMLElement);
      else if (t === 'thead' || t === 'tbody' || t === 'tfoot') collectRows(child as HTMLElement);
    }
  };
  collectRows(node);
  if (!rows.length) {
    writer.y -= style.margin[2];
    return;
  }

  // Determine column count and width hints from the first row.
  const colCount = Math.max(...rows.map((r) => cellNodes(r).length));
  const widthHints: (number | null)[] = new Array(colCount).fill(null);
  const firstRowCells = cellNodes(rows[0]);
  for (let c = 0; c < firstRowCells.length && c < colCount; c += 1) {
    const cs = parseStyle((firstRowCells[c] as HTMLElement).attributes?.style);
    if (cs.widthPct) widthHints[c] = cs.widthPct;
  }
  const fixed = widthHints.reduce((a: number, b: number | null) => a + (b ?? 0), 0);
  const remaining = 1 - fixed;
  const unsetCount = widthHints.filter((w) => w === null).length;
  const colWidths = widthHints.map((w) => (w !== null ? w * tableW : (remaining / Math.max(unsetCount, 1)) * tableW));

  const cellPad = 6;
  const lineHeightBase = 10 * 1.4;

  for (const row of rows) {
    const cells = cellNodes(row);
    // Measure each cell's content height.
    const cellLayouts: { lines: Run[][]; height: number; style: Style }[] = [];
    let rowHeight = 0;
    for (let c = 0; c < colCount; c += 1) {
      const cell = cells[c] as HTMLElement | undefined;
      const isHeader = cell ? cell.tagName.toLowerCase() === 'th' : false;
      const cellStyle = parseStyle(cell?.attributes?.style, { ...style, fontSize: style.fontSize || 10, bold: isHeader });
      const cw = colWidths[c];
      const { lines, height } = cell
        ? layoutInline(writer, cell, cellStyle, cw - cellPad * 2)
        : { lines: [[]], height: lineHeightBase };
      cellLayouts.push({ lines, height, style: cellStyle });
      rowHeight = Math.max(rowHeight, height);
    }
    rowHeight = Math.max(rowHeight, lineHeightBase) + cellPad * 2;

    writer.ensure(rowHeight);
    const rowTop = writer.y;
    const rowBottom = writer.y - rowHeight;

    // Draw cells.
    let cx = MARGIN;
    for (let c = 0; c < colCount; c += 1) {
      const cw = colWidths[c];
      const cl = cellLayouts[c];
      // Background.
      if (cl.style.bg) {
        writer.page.drawRectangle({ x: cx, y: rowBottom, width: cw, height: rowHeight, color: rgb(cl.style.bg.r, cl.style.bg.g, cl.style.bg.b) });
      }
      // Border.
      if (cl.style.border) {
        writer.page.drawRectangle({ x: cx, y: rowBottom, width: cw, height: rowHeight, borderColor: rgb(BORDER.r, BORDER.g, BORDER.b), borderWidth: 0.5, color: undefined });
      }
      // Text.
      const textY = rowTop - cellPad;
      const lineH = cl.style.fontSize * 1.4;
      const prevY = writer.y;
      writer.y = textY;
      drawLines(writer, cl.lines, cx + cellPad, cw - cellPad * 2, cl.style.align, lineH);
      writer.y = prevY - rowHeight;
      cx += cw;
    }
    writer.y = rowBottom;
  }
  writer.y -= style.margin[2] + 4;
}

function cellNodes(row: HTMLElement): HTMLElement[] {
  return row.childNodes.filter((c) => c.nodeType === 1 && ['td', 'th'].includes((c as HTMLElement).tagName.toLowerCase())) as HTMLElement[];
}

/** Iterates a node's children and renders each block/text node. */
function renderChildren(writer: Writer, node: HTMLElement, inherited: Style, contentWidth: number) {
  for (const child of children(node)) {
    if (child.nodeType === 3) {
      const text = (child as unknown as { text: string }).text || '';
      if (text.trim()) {
        const fake: HTMLElement = { childNodes: [child] } as unknown as HTMLElement;
        const { lines } = layoutInline(writer, fake, inherited, contentWidth);
        drawLines(writer, lines, MARGIN, contentWidth, inherited.align, inherited.fontSize * 1.4);
      }
      continue;
    }
    if (child.nodeType !== 1 || !child.tagName) continue;
    const tag = (child as HTMLElement).tagName.toLowerCase();
    if (['html', 'head', 'body', 'meta', 'style', 'script', 'link'].includes(tag)) {
      renderChildren(writer, child as HTMLElement, inherited, contentWidth);
      continue;
    }
    renderBlock(writer, child as HTMLElement, inherited, contentWidth);
  }
}

/** Renders an HTML string into the given pdf-lib document (appends pages). */
export async function renderHtmlInto(doc: PDFDocument, html: string): Promise<void> {
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
  const boldItalic = await doc.embedFont(StandardFonts.HelveticaBoldOblique);
  const writer = new Writer(doc);
  writer.fonts = { reg, bold, italic, boldItalic };

  const root = parse(html);
  const base: Style = {
    fontSize: 10,
    align: 'left',
    color: BLACK,
    bg: null,
    bold: false,
    italic: false,
    margin: [0, 0, 0, 0],
    padding: [0, 0],
    widthPct: null,
    border: false,
    pageBreak: false,
    valign: 'top',
  };

  const contentWidth = PAGE_W - MARGIN * 2;
  // If the root itself is a container (e.g. <div class="contrat">), render its children.
  if (root.tagName && ['div', 'section', 'article', 'main'].includes(root.tagName.toLowerCase())) {
    renderChildren(writer, root, base, contentWidth);
  } else {
    renderChildren(writer, root, base, contentWidth);
  }
}

/** Renders plain text (non-HTML) into the document as wrapped paragraphs. */
export async function renderTextInto(doc: PDFDocument, text: string, title?: string): Promise<void> {
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const writer = new Writer(doc);
  writer.fonts = { reg, bold, italic: reg, boldItalic: bold };
  const contentWidth = PAGE_W - MARGIN * 2;
  if (title) {
    writer.page.drawText(title, { x: MARGIN, y: writer.y, size: 14, font: bold, color: rgb(BLACK.r, BLACK.g, BLACK.b) });
    writer.y -= 24;
  }
  const safe = text.replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/[–—]/g, '-').replace(/…/g, '...');
  for (const para of safe.split('\n')) {
    if (!para.trim()) {
      writer.y -= 8;
      continue;
    }
    const words = para.split(/\s+/);
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (reg.widthOfTextAtSize(next, 10) > contentWidth && line) {
        writer.ensure(14);
        writer.page.drawText(line, { x: MARGIN, y: writer.y - 10, size: 10, font: reg, color: rgb(BLACK.r, BLACK.g, BLACK.b) });
        writer.y -= 14;
        line = word;
      } else {
        line = next;
      }
    }
    if (line) {
      writer.ensure(14);
      writer.page.drawText(line, { x: MARGIN, y: writer.y - 10, size: 10, font: reg, color: rgb(BLACK.r, BLACK.g, BLACK.b) });
      writer.y -= 14;
    }
  }
}
