import { NextRequest } from 'next/server';
import { isAdminUser, verifySession } from '@/lib/auth';

export async function isAdminOrCronAuthorized(request: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;
  const querySecret = request.nextUrl.searchParams.get('secret');
  const headerSecret = request.headers.get('x-cron-secret');
  const authHeader = request.headers.get('authorization');
  const bearerSecret = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

  if (cronSecret && [querySecret, headerSecret, bearerSecret].some((value) => value === cronSecret)) {
    return true;
  }

  const session = await verifySession();
  return isAdminUser(session);
}
