/**
 * DeepL Translation API Helper
 */

export async function translateWithDeepL(text: string, targetLang: string): Promise<string | null> {
  const apiKey = process.env['DEEPL_API_KEY'];
  if (!apiKey) return null;

  try {
    const baseUrl = apiKey.endsWith(':fx')
      ? 'https://api-free.deepl.com/v2/translate'
      : 'https://api.deepl.com/v2/translate';

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: [text],
        target_lang: targetLang,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    return data.translations?.[0]?.text || null;
  } catch {
    return null;
  }
}
