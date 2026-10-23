import { NextRequest, NextResponse } from 'next/server';
import { sendClosingReminders } from '@/lib/push';

// Lo llama un cron (Vercel Cron o similar) con "Authorization: Bearer <CRON_SECRET>". Es idempotente: se puede llamar cada pocos minutos.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }
  return NextResponse.json(await sendClosingReminders());
}
