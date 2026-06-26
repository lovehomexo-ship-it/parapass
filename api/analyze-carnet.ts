import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Clé API Anthropic manquante côté serveur.' });
  }

  const { images, prompt } = req.body as { images: Array<{ data: string; media_type: string }>; prompt: string };

  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'Aucune image fournie.' });
  }

  const imageContent = images.map((img) => ({
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: img.media_type as 'image/jpeg',
      data: img.data,
    },
  }));

  const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 8192,
      messages: [{
        role: 'user',
        content: [
          ...imageContent,
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });

  if (!anthropicRes.ok) {
    const body = await anthropicRes.json().catch(() => ({})) as { error?: { message?: string } };
    const msg = body.error?.message ?? `Erreur API Claude (${anthropicRes.status})`;
    return res.status(anthropicRes.status).json({ error: msg });
  }

  const data = await anthropicRes.json();
  return res.status(200).json(data);
}
