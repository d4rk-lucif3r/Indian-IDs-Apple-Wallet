// Copies the browser-side wasm/worker files into public/ so nothing loads from a third-party CDN.
import { cpSync, mkdirSync } from "node:fs";

const copies = [
  ["node_modules/pdfjs-dist/build/pdf.worker.min.mjs", "public/vendor/pdfjs/pdf.worker.min.mjs"],
  ["node_modules/pdfjs-dist/wasm", "public/vendor/pdfjs/wasm"],
  ["node_modules/zxing-wasm/dist/reader/zxing_reader.wasm", "public/vendor/zxing/zxing_reader.wasm"],
  ["node_modules/zxing-wasm/dist/writer/zxing_writer.wasm", "public/vendor/zxing/zxing_writer.wasm"],
  // OCR (Tesseract): worker, engine builds (it picks one per device) and English LSTM model
  ["node_modules/tesseract.js/dist/worker.min.js", "public/vendor/tesseract/worker.min.js"],
  ...["", "-simd", "-relaxedsimd"].flatMap((v) => [
    [`node_modules/tesseract.js-core/tesseract-core${v}-lstm.wasm.js`, `public/vendor/tesseract/core/tesseract-core${v}-lstm.wasm.js`],
    [`node_modules/tesseract.js-core/tesseract-core${v}.wasm.js`, `public/vendor/tesseract/core/tesseract-core${v}.wasm.js`],
  ]),
  ["node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "public/vendor/tesseract/lang/eng.traineddata.gz"],
  ["node_modules/@tesseract.js-data/hin/4.0.0_best_int/hin.traineddata.gz", "public/vendor/tesseract/lang/hin.traineddata.gz"],
];
for (const [from, to] of copies) {
  mkdirSync(to.slice(0, to.lastIndexOf("/")), { recursive: true });
  cpSync(from, to, { recursive: true });
}
console.log("Copied vendor assets to public/vendor");
