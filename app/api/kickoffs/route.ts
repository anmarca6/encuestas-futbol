import { NextResponse } from 'next/server';
import { loadKickoffOverrides } from '@/lib/kickoffs';

// Horas de inicio fijadas desde el admin. Sin cache: el cierre de predicciones depende de ellas.
export async function GET() {
  return NextResponse.json({ overrides: await loadKickoffOverrides() }, { headers: { 'Cache-Control': 'no-store' } });
}
