import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;

  return NextResponse.json({
    supported: Boolean(publicKey),
    publicKey: publicKey ?? null,
  });
}
