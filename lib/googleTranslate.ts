// Calls the Cloudflare Workers AI translator (m2m100-1.2b).
// Falls back to returning the original text if the worker is not configured.
// Keeps the same public API as the old Google Translate wrapper so callers need no changes.

const MAX_BATCH = 32;

function getConfig() {
  return {
    url: process.env.CF_TRANSLATOR_URL ?? "",
    secret: process.env.CF_TRANSLATOR_SECRET ?? "",
  };
}

export function hasGoogleTranslateKey(): boolean {
  return Boolean(getConfig().url);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function translateTexts(
  texts: string[],
  options: { source?: string; target?: string } = {}
): Promise<string[]> {
  if (texts.length === 0) return [];
  const { url, secret } = getConfig();
  if (!url) return texts;

  const target = options.target ?? "cs";
  const source = options.source ?? "en";
  const output = [...texts];

  await Promise.all(
    chunk(texts.map((t, i) => ({ t, i })), MAX_BATCH).map(async (batch) => {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(secret ? { "X-Translator-Secret": secret } : {}),
        },
        body: JSON.stringify({
          texts: batch.map((b) => b.t),
          sourceLanguage: source,
          targetLanguage: target,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) throw new Error(`CF translator ${res.status}`);
      const data = await res.json() as { translations?: string[] };
      const translations = data.translations ?? [];
      for (let i = 0; i < batch.length; i++) {
        if (translations[i]) output[batch[i].i] = translations[i];
      }
    })
  );

  return output;
}

export async function translateText(
  text: string,
  options: { source?: string; target?: string } = {}
): Promise<string> {
  const [result] = await translateTexts([text], options);
  return result ?? text;
}
