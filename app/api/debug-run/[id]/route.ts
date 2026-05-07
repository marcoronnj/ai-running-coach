import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = await params;

  const activity = await queryOne(
    `
      SELECT id, strava_id, name, start_date
      FROM activities
      WHERE id = $1 OR strava_id = $1
      LIMIT 1
    `,
    [id]
  );

  const report = activity
    ? await queryOne(
        `
          SELECT id
          FROM coach_reports
          WHERE activity_id = $1
          ORDER BY created_at DESC
          LIMIT 1
        `,
        [activity.id]
      )
    : null;

  return NextResponse.json({
    requestedId: id,
    activityFound: Boolean(activity),
    activityId: activity?.id ?? null,
    stravaId: activity?.strava_id ?? null,
    reportFound: Boolean(report),
    latestReportId: report?.id ?? null,
    startDate: activity?.start_date ?? null,
    name: activity?.name ?? null,
  });
}
