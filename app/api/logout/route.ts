import { NextRequest, NextResponse } from 'next/server';
import { logout } from '@/lib/auth';

export async function POST(request: NextRequest) {
  await logout();
  return NextResponse.redirect(new URL('/login', request.url), { status: 303 });
}

export async function GET(request: NextRequest) {
  await logout();
  return NextResponse.redirect(new URL('/login', request.url), { status: 303 });
}
