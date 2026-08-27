const pageUrl = "https://www.onearthtrip.com/2012/12/abu-dhabi-christmas-2012";
const imagePath = "/images/actual/abu-dhabi-christmas-lobby-2012-mosaic.webp";
const imageUrl = `https://www.onearthtrip.com${imagePath}`;

async function fetchWithRetry(url, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "cache-control": "no-cache",
          "user-agent": "OnEarthTrip-Christmas-Image-Check/1.0",
          ...(options.headers ?? {})
        },
        signal: AbortSignal.timeout(15000)
      });
      if (response.ok) return response;
      lastError = new Error(`${url} returned HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < 12) await new Promise((resolve) => setTimeout(resolve, 10000));
  }
  throw lastError;
}

const pageResponse = await fetchWithRetry(pageUrl);
const html = await pageResponse.text();
if (!html.includes(imagePath)) {
  throw new Error(`Live article does not reference ${imagePath}`);
}
console.log(`PASS: live article references ${imagePath}`);

const imageResponse = await fetchWithRetry(imageUrl);
const contentType = imageResponse.headers.get("content-type") ?? "";
const bytes = new Uint8Array(await imageResponse.arrayBuffer());

if (!contentType.toLowerCase().includes("image/webp")) {
  throw new Error(`Expected image/webp, got ${contentType || "missing content-type"}`);
}
if (bytes.length < 100000) {
  throw new Error(`Live Christmas image is unexpectedly small: ${bytes.length} bytes`);
}
if (
  String.fromCharCode(...bytes.slice(0, 4)) !== "RIFF" ||
  String.fromCharCode(...bytes.slice(8, 12)) !== "WEBP"
) {
  throw new Error("Live Christmas image does not have a valid WebP RIFF signature");
}

console.log(`PASS: live Christmas mosaic image is valid WebP (${bytes.length} bytes).`);
