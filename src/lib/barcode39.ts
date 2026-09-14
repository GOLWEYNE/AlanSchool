// Code 39 ("3 of 9") barcode encoding - the ID-badge half of the roadmap's
// "QR-code or ID-badge scan check-in flow". Chosen over a QR code because
// Code 39's character-to-pattern table is small, fixed, and has been public
// and unchanged for decades, so it can be vendored and verified by hand;
// a hand-rolled QR encoder (Reed-Solomon error correction, mask scoring,
// version/format bits) is far too easy to get subtly wrong in a way that
// looks fine on screen but never scans on a real physical scanner.
//
// CODE39_CHARS / CODE39_PATTERNS below are ported verbatim from the
// widely-used, MIT-licensed JsBarcode library
// (https://unpkg.com/browse/jsbarcode/src/barcodes/CODE39/index.js) rather
// than re-derived, specifically to avoid introducing a new transcription
// error. Each pattern is a bar/space module-width bitmap (1 = black module,
// 0 = white module) for one Code 39 character: every real character (not
// "*") is exactly 15 modules wide (6 narrow + 3 wide elements, 3 modules
// per wide element - the "3 of 9" property Code 39 is named for). "*"'s
// stored value is 16 bits: the same 15-module start/stop pattern plus one
// extra trailing narrow (white) module, which doubles as the mandatory
// inter-character gap whichever side "*" is used on (see encodeCode39).

const CODE39_CHARS = [
  "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
  "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T",
  "U", "V", "W", "X", "Y", "Z",
  "-", ".", " ", "$", "/", "+", "%", "*",
];

const CODE39_PATTERNS = [
  20957, 29783, 23639, 30485, 20951, 29813, 23669, 20855, 29789, 23645,
  29975, 23831, 30533, 22295, 30149, 24005, 21623, 29981, 23837, 22301,
  30023, 23879, 30545, 22343, 30161, 24017, 21959, 30065, 23921, 22385,
  29015, 18263, 29141, 17879, 29045, 18293, 17783, 29021, 18269, 17477,
  17489, 17681, 20753, 35770,
];

// Code 39 can only represent digits, uppercase A-Z, space, and - . $ / + %.
// A badge encodes a sanitized form of the student's Clerk id, never their
// username (an admin can type that in any script - this school uses
// Cyrillic class/subject names, so Cyrillic usernames are a real
// possibility) and never the raw id as-is (Clerk ids contain lowercase
// letters and underscores, neither of which Code 39 supports). Applying
// this same function on both the printed badge and every check-in lookup
// keeps the two always in agreement without needing a stored "badge code"
// field (and the schema migration that would require).
export const sanitizeForBadge = (raw: string): string =>
  raw.toUpperCase().replace(/[^0-9A-Z\-. $/+%]/g, "-");

const patternFor = (char: string): string => {
  const index = CODE39_CHARS.indexOf(char);
  if (index === -1) {
    throw new Error(`Character "${char}" is not encodable in Code 39.`);
  }
  return CODE39_PATTERNS[index].toString(2);
};

// Full barcode as a string of "1"/"0" module widths, start/stop "*"
// included. `text` must already be sanitizeForBadge-safe.
export const encodeCode39 = (text: string): string => {
  const body = text
    .split("")
    .map((char) => patternFor(char) + "0")
    .join("");
  return patternFor("*") + body + patternFor("*");
};

export type BarcodeRun = { black: boolean; width: number };

// Same barcode, run-length encoded (one entry per bar or space) - the shape
// an SVG renderer actually wants, so it doesn't draw one <rect> per module.
export const code39Runs = (text: string): BarcodeRun[] => {
  const bits = encodeCode39(text);
  const runs: BarcodeRun[] = [];
  let current = bits[0];
  let count = 0;
  for (const bit of bits) {
    if (bit === current) {
      count += 1;
    } else {
      runs.push({ black: current === "1", width: count });
      current = bit;
      count = 1;
    }
  }
  runs.push({ black: current === "1", width: count });
  return runs;
};
