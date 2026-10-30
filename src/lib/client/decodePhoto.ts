// Browser-only: the photo inside the Secure QR is JPEG 2000, which browsers can't display.
// pdf.js ships an OpenJPEG wasm decoder; we use it to turn the photo into a PNG data URL.

interface JpxDecoder {
  setOptions(opts: { useWasm: boolean; useWorkerFetch: boolean; wasmUrl: string }): void;
  parseImageProperties(bytes: Uint8Array): { width: number; height: number };
  instance: { decode(bytes: Uint8Array, opts: { numComponents: number }): Promise<Uint8ClampedArray> };
}

let jpx: Promise<JpxDecoder> | null = null;
function decoder() {
  jpx ??= import(
    // @ts-expect-error -- pdf.js doesn't ship types for the standalone image decoders
    "pdfjs-dist/image_decoders/pdf.image_decoders.mjs"
  ).then(({ JpxImage }: { JpxImage: JpxDecoder }) => {
    JpxImage.setOptions({ useWasm: true, useWorkerFetch: true, wasmUrl: "/vendor/pdfjs/wasm/" });
    return JpxImage;
  });
  return jpx;
}

function toRgba(pixels: Uint8ClampedArray, count: number): Uint8ClampedArray<ArrayBuffer> {
  const channels = pixels.length / count;
  if (![1, 3, 4].includes(channels)) throw new Error(`Unexpected ${channels} channels in photo`);
  const out = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i++) {
    const src = i * channels;
    out[i * 4] = pixels[src];
    out[i * 4 + 1] = pixels[channels === 1 ? src : src + 1];
    out[i * 4 + 2] = pixels[channels === 1 ? src : src + 2];
    out[i * 4 + 3] = channels === 4 ? pixels[src + 3] : 255;
  }
  return out;
}

export async function jp2ToPngDataUrl(bytes: Uint8Array): Promise<string | null> {
  try {
    const JpxImage = await decoder();
    const { width, height } = JpxImage.parseImageProperties(bytes);
    // numComponents 0 = native layout; the decoder returns 1 (grey), 3 (RGB) or 4 (RGBA) bytes per pixel.
    const pixels = await JpxImage.instance.decode(bytes, { numComponents: 0 });
    const rgba = toRgba(pixels, width * height);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")!.putImageData(new ImageData(rgba, width, height), 0, 0);
    return canvas.toDataURL("image/png");
  } catch (err) {
    console.warn("Couldn't decode Aadhaar photo", err);
    return null;
  }
}
