import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { sanitizeAiSpec } from '@/lib/image-generator';

const MAX_PROMPT = 4000;

const SYSTEM_PROMPT = `Eres el asistente del generador de imágenes estadísticas de la Granota App, una porra de aficionados del Levante UD.
El administrador te describe unos datos en lenguaje natural (por ejemplo "goles encajados por minuto: 0-15 dos, 16-30 uno...") y tú los conviertes en la ficha de una infografía.
Responde SOLO con un objeto JSON, sin texto antes ni después ni bloques de código, con estas claves:
- "kicker": texto pequeño sobre el título, p. ej. "Estadística · LaLiga 2026/27" (máx. 60 caracteres)
- "title": primera línea del título en blanco, corta (máx. 25 caracteres), p. ej. "¿Cuándo"
- "titleAccent": segunda línea del título en rojo (máx. 25 caracteres), p. ej. "encaja el Levante?"
- "subtitle": una o dos frases que expliquen los datos y destaquen lo más llamativo (máx. 200 caracteres)
- "layout": "barras" (columnas en orden, ideal para tramos de minutos o jornadas) o "ranking" (barras horizontales ordenadas de mayor a menor, ideal para jugadores o equipos)
- "rows": lista de { "label": texto corto, "value": número >= 0 }, máximo 12, en el orden en que deben verse
- "showPercent": true si el porcentaje sobre el total ayuda a entender los datos
- "dividerAfter": en "barras", número de columnas de la primera parte del partido si los datos son por minutos (por ejemplo 3 con tramos de 15 minutos), o 0 si no procede
- "dividerLabels": ["1ª PARTE", "2ª PARTE"]
- "cards": hasta 3 datos clave { "value": cifra corta como "69%" o "7", "text": explicación de menos de 60 caracteres }, calculados con rigor a partir de los datos
- "footer": fuente y aclaraciones breves (máx. 200 caracteres)
Reglas: usa únicamente los datos que te da el administrador; no inventes cifras ni partidos; comprueba que los cálculos de las tarjetas son correctos; escribe en español.`;

// Convierte una descripcion de datos escrita a mano en la ficha de la imagen (titulos, filas y tarjetas).
export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (admin instanceof NextResponse) return admin;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'La IA no está configurada en el servidor (falta ANTHROPIC_API_KEY). Puedes rellenar el formulario a mano.' }, { status: 503 });
  }
  const body = (await request.json().catch(() => null)) as { prompt?: string } | null;
  const prompt = (body?.prompt ?? '').trim();
  if (!prompt) return NextResponse.json({ error: 'Describe los datos que quieres mostrar.' }, { status: 400 });
  if (prompt.length > MAX_PROMPT) return NextResponse.json({ error: `El texto no puede pasar de ${MAX_PROMPT} caracteres.` }, { status: 400 });

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    return NextResponse.json({ error: 'La IA no ha respondido a tiempo. Inténtalo de nuevo.' }, { status: 504 });
  }
  if (!response.ok) {
    return NextResponse.json({ error: `La IA ha devuelto un error (${response.status}). Inténtalo de nuevo o rellena el formulario a mano.` }, { status: 502 });
  }
  const payload = (await response.json().catch(() => null)) as { content?: Array<{ type: string; text?: string }> } | null;
  const text = payload?.content?.find((block) => block.type === 'text')?.text ?? '';
  const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return NextResponse.json({ error: 'No he podido interpretar la respuesta de la IA. Reformula los datos e inténtalo de nuevo.' }, { status: 502 });
  }
  const spec = sanitizeAiSpec(parsed);
  if (!spec.rows?.length) {
    return NextResponse.json({ error: 'La IA no ha encontrado datos numéricos en tu texto. Indica cada dato con su cifra.' }, { status: 422 });
  }
  return NextResponse.json({ spec });
}
