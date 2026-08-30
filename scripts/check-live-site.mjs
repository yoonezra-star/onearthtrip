import { createHash } from "node:crypto";

const canonicalOrigin = "https://www.onearthtrip.com";
const apexOrigin = "https://onearthtrip.com";
const publisherId = "ca-pub-6918910185244897";
const adsTxtLine = "google.com, pub-6918910185244897, DIRECT, f08c47fec0942fa0";
const dubaiMosaicVideoPath = "/videos/actual/dubai-fountain-2012-mosaic-v4.mp4";
const dubaiMosaicVideoBytes = 24426606;
const privacyMosaicImages = [
  {
    path: "/images/actual/abu-dhabi-korean-community-space-2015-mosaic-v2.webp",
    bytes: 97842,
    sha256: "9b223ec1d3251ea8a84a24416f4ff0f438ab0d73d5c0d5351cc1f4fe7304560b",
    label: "Korean community privacy mosaic"
  },
  {
    path: "/images/actual/abu-dhabi-neighborhood-playground-2019-mosaic-v2.webp",
    bytes: 523006,
    sha256: "8e9c2586a56cd738e0c4bfa88a2c77d20a935aa16d0c480eac5b17d62f4e45e2",
    label: "Neighborhood playground privacy mosaic"
  },
  {
    path: "/images/actual/abu-dhabi-shaded-playground-2019-mosaic-v2.webp",
    bytes: 418450,
    sha256: "08eef6010aa197ba34d4c7b7ea65d238aac04c9d88445dbe87a1a14413dd50b0",
    label: "Shaded playground privacy mosaic"
  },
  {
    path: "/images/actual/grand-mosque-visitor-flow-2012-mosaic-v2.webp",
    bytes: 175536,
    sha256: "a7ad8d1052807ac57a7fecee41785dde871f44bb2545165d06fcf5946e4bdfdc",
    label: "Grand Mosque visitor privacy mosaic"
  },
  {
    path: "/images/actual/abu-dhabi-hotel-buffet-2019-mosaic-v2.webp",
    bytes: 227500,
    sha256: "60db4cac9338db14b56b3d12a0f1c4b8d371944b9a3cab0aabf3bd15e4734f6f",
    label: "Hotel buffet privacy mosaic"
  }
];

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
          "user-agent": "OnEarthTrip-Live-Readiness/1.0",
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
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      }
    }
  }

  throw lastError;
}

async function checkRedirect(source, expectedTarget, label) {
  try {
    const response = await request(source, { redirect: "manual" });
    const location = response.headers.get("location");

    if (response.status !== 301) {
      fail(`${label}: expected HTTP 301, got ${response.status}.`);
      return;
    }

    if (!location) {
      fail(`${label}: redirect response has no Location header.`);
      return;
    }

    const resolvedLocation = new URL(location, source).toString();
    if (resolvedLocation !== expectedTarget) {
      fail(`${label}: expected ${expectedTarget}, got ${resolvedLocation}.`);
      return;
    }

    pass(`${label}: ${source} -> ${expectedTarget} (301)`);
  } catch (error) {
    fail(`${label}: request failed: ${error.message}`);
  }
}

async function checkHtml(url, checks, label) {
  try {
    const response = await request(url);
    const html = await response.text();

    if (response.status !== 200) {
      fail(`${label}: expected HTTP 200, got ${response.status}.`);
      return;
    }

    let failed = false;
    for (const check of checks) {
      if (!check.test(html)) {
        failed = true;
        fail(`${label}: missing ${check.description}.`);
      }
    }

    if (!failed) {
      pass(`${label}: HTTP 200 and expected production markers found.`);
    }
  } catch (error) {
    fail(`${label}: request failed: ${error.message}`);
  }
}

async function checkText(url, validator, label) {
  try {
    const response = await request(url);
    const text = await response.text();

    if (response.status !== 200) {
      fail(`${label}: expected HTTP 200, got ${response.status}.`);
      return;
    }

    const error = validator(text);
    if (error) {
      fail(`${label}: ${error}`);
      return;
    }

    pass(`${label}: HTTP 200 and content validated.`);
  } catch (error) {
    fail(`${label}: request failed: ${error.message}`);
  }
}

async function checkVideoAsset(url, label, expectedBytes) {
  try {
    // Keep this request same-origin: a 3xx here can break browser media seeking/playback.
    const response = await request(url, {
      redirect: "manual",
      headers: { range: "bytes=0-1023" }
    });
    const contentType = response.headers.get("content-type") ?? "";
    const contentRange = response.headers.get("content-range") ?? "";
    const contentLength = response.headers.get("content-length") ?? "";

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      fail(`${label}: must be served directly from oneearthtrip.com, got redirect ${response.status}.`);
      return;
    }

    if (![200, 206].includes(response.status)) {
      fail(`${label}: expected HTTP 200/206, got ${response.status}.`);
      return;
    }

    const normalizedType = contentType.toLowerCase();
    if (!normalizedType.includes("video/mp4")) {
      fail(`${label}: expected video/mp4, got ${contentType || "no content-type"}.`);
      return;
    }

    let totalBytes;
    if (response.status === 206) {
      const rangeMatch = contentRange.match(/^bytes\s+0-\d+\/(\d+)$/i);
      if (!rangeMatch) {
        fail(`${label}: partial response is missing a valid Content-Range header.`);
        return;
      }
      totalBytes = Number(rangeMatch[1]);
    } else if (/^\d+$/.test(contentLength)) {
      totalBytes = Number(contentLength);
    }

    if (totalBytes !== expectedBytes) {
      fail(`${label}: expected ${expectedBytes} bytes, got ${totalBytes ?? "unknown"}.`);
      return;
    }

    pass(`${label}: same-origin MP4 responds correctly (${response.status}, ${totalBytes} bytes).`);
  } catch (error) {
    fail(`${label}: request failed: ${error.message}`);
  }
}

async function checkImageAsset(url, label, expectedBytes, expectedSha256) {
  try {
    const response = await request(url, { redirect: "manual" });
    const contentType = response.headers.get("content-type") ?? "";

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      fail(`${label}: must be served directly from oneearthtrip.com, got redirect ${response.status}.`);
      return;
    }

    if (response.status !== 200) {
      fail(`${label}: expected HTTP 200, got ${response.status}.`);
      return;
    }

    if (!contentType.toLowerCase().includes("image/webp")) {
      fail(`${label}: expected image/webp, got ${contentType || "no content-type"}.`);
      return;
    }

    const data = Buffer.from(await response.arrayBuffer());
    if (data.length !== expectedBytes) {
      fail(`${label}: expected ${expectedBytes} bytes, got ${data.length}.`);
      return;
    }

    const digest = createHash("sha256").update(data).digest("hex");
    if (digest !== expectedSha256) {
      fail(`${label}: expected SHA-256 ${expectedSha256}, got ${digest}.`);
      return;
    }

    pass(`${label}: live WebP matches expected ${expectedBytes} bytes and SHA-256.`);
  } catch (error) {
    fail(`${label}: request failed: ${error.message}`);
  }
}

await checkRedirect(
  `${apexOrigin}/`,
  `${canonicalOrigin}/`,
  "Apex root canonical redirect"
);

await checkRedirect(
  `${apexOrigin}/reading-guide?utm_source=test`,
  `${canonicalOrigin}/reading-guide?utm_source=test`,
  "Apex path/query canonical redirect"
);

await checkHtml(
  `${canonicalOrigin}/`,
  [
    {
      description: "On Earth Trip in the document title",
      test: (html) => /<title>[^<]*On Earth Trip[^<]*<\/title>/i.test(html)
    },
    {
      description: "canonical homepage URL",
      test: (html) => /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.onearthtrip\.com\/?["']/i.test(html)
        || /<link[^>]+href=["']https:\/\/www\.onearthtrip\.com\/?["'][^>]+rel=["']canonical["']/i.test(html)
    },
    {
      description: "Google AdSense account meta",
      test: (html) => new RegExp(`<meta[^>]+name=["']google-adsense-account["'][^>]+content=["']${publisherId}["']`, "i").test(html)
        || new RegExp(`<meta[^>]+content=["']${publisherId}["'][^>]+name=["']google-adsense-account["']`, "i").test(html)
    },
    {
      description: "reading guide navigation",
      test: (html) => /href=["']\/reading-guide["']/i.test(html)
    }
  ],
  "Canonical homepage"
);

await checkHtml(
  `${canonicalOrigin}/reading-guide`,
  [
    {
      description: "reading-guide canonical URL",
      test: (html) => /<link[^>]+rel=["']canonical["'][^>]+href=["']https:\/\/www\.onearthtrip\.com\/reading-guide["']/i.test(html)
        || /<link[^>]+href=["']https:\/\/www\.onearthtrip\.com\/reading-guide["'][^>]+rel=["']canonical["']/i.test(html)
    },
    {
      description: "single visible H1",
      test: (html) => (html.match(/<h1\b/gi) ?? []).length === 1
    }
  ],
  "Reading guide"
);

await checkHtml(
  `${canonicalOrigin}/2012/12/dubai-burj-khalifa-2012`,
  [
    {
      description: "exact Dubai fountain mosaic video source",
      test: (html) => html.includes(`src=\"${dubaiMosaicVideoPath}\"`)
        || html.includes(`src='${dubaiMosaicVideoPath}'`)
    },
    {
      description: "Dubai article canonical URL",
      test: (html) => html.includes(`${canonicalOrigin}/2012/12/dubai-burj-khalifa-2012`)
    }
  ],
  "Dubai Burj Khalifa field note"
);

await checkVideoAsset(
  `${canonicalOrigin}${dubaiMosaicVideoPath}`,
  "Dubai fountain mosaic video",
  dubaiMosaicVideoBytes
);

await checkHtml(
  `${canonicalOrigin}/2015/03/abu-dhabi-korean-community-space-2015`,
  [
    {
      description: "cache-busted Korean community privacy mosaic",
      test: (html) => html.includes(privacyMosaicImages[0].path)
    },
    {
      description: "Korean community privacy-edit disclosure",
      test: (html) => html.includes("식별 가능성이 있는 얼굴은 모자이크 처리했습니다")
    },
    {
      description: "Korean community article canonical URL",
      test: (html) => html.includes(`${canonicalOrigin}/2015/03/abu-dhabi-korean-community-space-2015`)
    }
  ],
  "Korean community field note"
);

await checkHtml(
  `${canonicalOrigin}/2019/12/abu-dhabi-neighborhood-playground-2019`,
  [
    {
      description: "cache-busted neighborhood playground privacy mosaic",
      test: (html) => html.includes(privacyMosaicImages[1].path)
    },
    {
      description: "cache-busted shaded playground privacy mosaic",
      test: (html) => html.includes(privacyMosaicImages[2].path)
    },
    {
      description: "playground privacy-edit disclosure",
      test: (html) => html.includes("식별 가능한 얼굴은 모자이크 처리했습니다")
    },
    {
      description: "playground article canonical URL",
      test: (html) => html.includes(`${canonicalOrigin}/2019/12/abu-dhabi-neighborhood-playground-2019`)
    }
  ],
  "Neighborhood playground field note"
);

await checkHtml(
  `${canonicalOrigin}/2026/04/blog-post_11`,
  [
    {
      description: "cache-busted Grand Mosque visitor privacy mosaic",
      test: (html) => html.includes(privacyMosaicImages[3].path)
    },
    {
      description: "Grand Mosque visitor privacy-edit disclosure",
      test: (html) => html.includes("식별 가능한 얼굴은 모자이크 처리했습니다")
    },
    {
      description: "Grand Mosque article canonical URL",
      test: (html) => html.includes(`${canonicalOrigin}/2026/04/blog-post_11`)
    }
  ],
  "Grand Mosque field note"
);

for (const image of privacyMosaicImages) {
  await checkImageAsset(
    `${canonicalOrigin}${image.path}`,
    image.label,
    image.bytes,
    image.sha256
  );
}

await checkText(
  `${canonicalOrigin}/ads.txt`,
  (text) => text.trim() === adsTxtLine ? null : `expected exact ads.txt line: ${adsTxtLine}`,
  "ads.txt"
);

await checkText(
  `${canonicalOrigin}/robots.txt`,
  (text) => {
    if (!/User-agent:\s*\*/i.test(text)) return "missing User-agent: *";
    if (!/Allow:\s*\//i.test(text)) return "missing Allow: /";
    if (!text.includes(`Sitemap: ${canonicalOrigin}/sitemap-index.xml`)) {
      return "missing canonical sitemap-index.xml declaration";
    }
    return null;
  },
  "robots.txt"
);

await checkText(
  `${canonicalOrigin}/sitemap-index.xml`,
  (text) => text.includes(`<loc>${canonicalOrigin}/sitemap-0.xml</loc>`)
    ? null
    : "missing canonical sitemap-0.xml location",
  "sitemap-index.xml"
);

await checkText(
  `${canonicalOrigin}/sitemap-0.xml`,
  (text) => {
    if (!text.includes(`<loc>${canonicalOrigin}/</loc>`)) return "missing canonical homepage URL";
    if (!text.includes(`<loc>${canonicalOrigin}/reading-guide</loc>`)) return "missing reading-guide URL";
    if (/<loc>https:\/\/onearthtrip\.com\//i.test(text)) return "contains non-www sitemap URLs";
    return null;
  },
  "sitemap-0.xml"
);

if (failures.length) {
  console.error(`\nLive site readiness failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log("\nLive site readiness passed: canonical redirects, production HTML, same-origin privacy-edited media, ads.txt, robots.txt, and sitemaps are consistent.\n");
