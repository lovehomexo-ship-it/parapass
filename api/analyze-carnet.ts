import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';

const OCR_PROMPT = `Tu es un expert en lecture de carnets de sauts parachutisme français (format FFP).
Analyse TOUTES les pages fournies et extrais ABSOLUMENT TOUS les sauts visibles dans les tableaux.

Pour chaque ligne de saut retourne un objet JSON avec ces champs exacts :
- numero : numéro du saut (string, ex: "142")
- date : DD/MM/YYYY (ex: "15/06/2024"), "" si illisible
- lieu : DZ ou centre (ex: "BigAir Rochefort"), "" si illisible
- aeronef : immatriculation ou type avion (ex: "F-HABC"), "" si illisible
- hauteur : altitude de largage en mètres, NOMBRE SEUL (ex: "4000"), "4000" si illisible
- hauteur_ouverture : altitude ouverture (ex: "1500"), "1500" si illisible
- voilure : voilure principale (ex: "PD-270"), "" si illisible
- programme : programme du saut (ex: "PAC 3", "Solo", "VRW"), "" si absent
- nature : un seul parmi "entrainement" | "competition" | "manifestation" | "travail_aerien"
- nom_moniteur : nom du moniteur signataire, "" si absent
- observations : observations si lisibles, "" sinon
- confiance : entier 0-100 représentant la qualité de lecture de cette ligne

Règles importantes :
1. Inclus TOUTES les lignes visibles, même partiellement lisibles (confiance peut être faible)
2. Ne saute AUCUNE ligne du tableau, même si certains champs sont vides
3. Si une ligne est presque illisible, inclus-la avec confiance ≤ 30 et les champs lisibles

Retourne UNIQUEMENT un tableau JSON valide, sans aucun texte avant ou après, sans markdown.
Format : [{"numero":"1","date":"20/05/2024","lieu":"BigAir","aeronef":"Pilatus","hauteur":"4000","hauteur_ouverture":"1500","voilure":"PD-270","programme":"PAC 1","nature":"entrainement","nom_moniteur":"MARTIN Paul","observations":"","confiance":90}, ...]`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { images } = req.body as { images: string[] };

  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'Aucune image fournie.' });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      messages: [{
        role: 'user',
        content: [
          ...images.map((data) => ({
            type: 'image' as const,
            source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data },
          })),
          { type: 'text' as const, text: OCR_PROMPT },
        ],
      }],
    });

    const text = response.content.find((c) => c.type === 'text')?.text ?? '[]';
    return res.status(200).json({ result: text });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue';
    return res.status(500).json({ error: msg });
  }
}
