import { NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { formatDateTimeIT, formatTimeIT } from '@/lib/date-utils';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  const { id } = await params;

  const activity = await queryOne(
    `
      SELECT id, strava_id, name, start_date, raw_json
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
  let rawJson = activity?.raw_json;
  if (typeof rawJson === 'string') {
    try {
      rawJson = JSON.parse(rawJson);
    } catch {
      rawJson = null;
    }
  }

  return NextResponse.json({
    requestedId: id,
    activityFound: Boolean(activity),
    activityId: activity?.id ?? null,
    stravaId: activity?.strava_id ?? null,
    reportFound: Boolean(report),
    latestReportId: report?.id ?? null,
    startDate: activity?.start_date ?? null,
    startDateRome: activity?.start_date ? formatDateTimeIT(activity.start_date) : null,
    startTimeRome: activity?.start_date ? formatTimeIT(activity.start_date) : null,
    stravaStartDateUtc: rawJson?.start_date ?? null,
    stravaStartDateLocal: rawJson?.start_date_local ?? null,
    stravaTimezone: rawJson?.timezone ?? null,
    stravaUtcOffsetSeconds: rawJson?.utc_offset ?? null,
    name: activity?.name ?? null,
  });
}
