const canonicalOrigin = "https://www.onearthtrip.com";
const representativeImage = "/images/actual/grand-mosque-night.webp";
const representativeVideo = "/videos/actual/dubai-fountain-2012-mosaic-v4.mp4";
const failures = [];

function fail(message) {
  failures.push(message);
  console.error(`FAIL: ${message}`);
}

function pass(message) {
  console.log(`PASS: ${message}`);
}

async function request(url, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "cache-control": "no-cache",
          "user-agent": "OnEarthTrip-Live-Cache/1.0",
          ...(options.headers ?? {})
        },
        signal: AbortSignal.timeout(15000)
      });
      if (response.status >= 500 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
  throw lastError;
}

function parseCacheControl(value) {
  return new Map(
    (value ?? "")
      .split(",")
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean)
      .map((part) => {
        const [key, rawValue] = part.split("=", 2);
        return [key, rawValue ?? true];
      })
  );
}

function validateCacheControl(response, label, { minMaxAge, immutable = false, staleWhileRevalidate } = {}) {
  const value = response.headers.get("cache-control") ?? "";
  const directives = parseCacheControl(value);
  const maxAge = Number(directives.get("max-age"));

  if (!directives.has("public")) {
    fail(`${label}: Cache-Control must include public; got ${value || "no header"}.`);
    return false;
  }
  if (!Number.isFinite(maxAge) || maxAge < minMaxAge) {
    fail(`${label}: expected max-age >= ${minMaxAge}; got ${value || "no header"}.`);
    return false;
  }
  if (immutable && !directives.has("immutable")) {
    fail(`${label}: expected immutable; got ${value || "no header"}.`);
    return false;
  }
  if (staleWhileRevalidate != null) {
    const stale = Number(directives.get("stale-while-revalidate"));
    if (!Number.isFinite(stale) || stale < staleWhileRevalidate) {
      fail(`${label}: expected stale-while-revalidate >= ${staleWhileRevalidate}; got ${value || "no header"}.`);
      return false;
    }
  }

  pass(`${label}: ${value}`);
  return true;
}

async function checkHomepageAndAstroAsset() {
  try {
    const response = await request(`${canonicalOrigin}/`);
    if (response.status !== 200) {
      fail(`Homepage: expected HTTP 200, got ${response.status}.`);
      return;
    }

    const html = await response.text();
    const assetMatch = html.match(/(?:href|src)=["'](\/_astro\/[^"']+\.(?:css|js))["']/i);
    if (!assetMatch) {
      fail("Homepage: no hashed /_astro/ CSS or JS asset was found for live cache verification.");
      return;
    }

    const assetUrl = new URL(assetMatch[1], canonicalOrigin).toString();
    const assetResponse = await request(assetUrl);
    if (assetResponse.status !== 200) {
      fail(`Hashed Astro asset: expected HTTP 200, got ${assetResponse.status}.`);
      return;
    }

    validateCacheControl(assetResponse, "Hashed Astro asset", {
      minMaxAge: 31536000,
      immutable: true
    });
  } catch (error) {
    fail(`Homepage/Astro cache check failed: ${error.message}`);
  }
}

async function checkImage() {
  try {
    const response = await request(`${canonicalOrigin}${representativeImage}`);
    if (response.status !== 200) {
      fail(`Representative image: expected HTTP 200, got ${response.status}.`);
      return;
    }
    validateCacheControl(response, "Representative image", {
      minMaxAge: 86400,
      staleWhileRevalidate: 604800
    });
  } catch (error) {
    fail(`Representative image cache check failed: ${error.message}`);
  }
}

async function checkVideo() {
  try {
    const response = await request(`${canonicalOrigin}${representativeVideo}`, {
      headers: { range: "bytes=0-1023" },
      redirect: "manual"
    });
    if (![200, 206].includes(response.status)) {
      fail(`Representative video: expected HTTP 200/206, got ${response.status}.`);
      return;
    }
    validateCacheControl(response, "Representative video", {
      minMaxAge: 86400,
      staleWhileRevalidate: 604800
    });
  } catch (error) {
    fail(`Representative video cache check failed: ${error.message}`);
  }
}

await checkHomepageAndAstroAsset();
await checkImage();
await checkVideo();

if (failures.length > 0) {
  console.error(`Live cache policy validation failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log("Live cache policy validation passed for hashed Astro assets, first-party images, and first-party video.");
