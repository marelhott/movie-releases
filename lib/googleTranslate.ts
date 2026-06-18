const GOOGLE_TRANSLATE_ENDPOINT = "https://translation.googleapis.com/language/translate/v2";
const MAX_BATCH_ITEMS = 32;

type TranslateBatchOptions = {
  source?: string;
  target?: string;
};

function getKey() {
  return process.env.GOOGLE_TRANSLATE_API_KEY || process.env.GOOGLE_CLOUD_TRANSLATE_API_KEY || "";
}

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function normalizeTranslatedText(input: string) {
  return decodeHtmlEntities(input)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export function hasGoogleTranslateKey() {
  return Boolean(getKey());
}

export async function translateTexts(
  texts: string[],
  options: TranslateBatchOptions = {}
): Promise<string[]> {
  if (texts.length === 0) return [];

  const key = getKey();
  if (!key) return texts;

  const target = options.target ?? "cs";
  const indexed = texts.map((text, index) => ({ text: String(text ?? ""), index }));
  const output = [...texts];

  await Promise.all(
    chunk(indexed, MAX_BATCH_ITEMS).map(async (batch) => {
      const body = new URLSearchParams();
      body.set("target", target);
      body.set("format", "text");
      if (options.source) body.set("source", options.source);
      for (const item of batch) {
        body.append("q", item.text);
      }

      const res = await fetch(`${GOOGLE_TRANSLATE_ENDPOINT}?key=${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: body.toString(),
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Google Translate ${res.status}`);
      }

      const data = await res.json() as {
        data?: {
          translations?: Array<{ translatedText?: string }>;
        };
      };

      const translations = data.data?.translations ?? [];
      for (let index = 0; index < batch.length; index++) {
        output[batch[index].index] = normalizeTranslatedText(translations[index]?.translatedText ?? batch[index].text);
      }
    })
  );

  return output;
}

export async function translateText(text: string, options: TranslateBatchOptions = {}) {
  const [translated] = await translateTexts([text], options);
  return translated ?? text;
}
