import { NextResponse } from 'next/server';
import { getOpenAIErrorDetails, getDailyOpenAIModel, OPENAI_RESPONSES_ENDPOINT } from '@/lib/openai-client';
import { runOpenAITest } from '@/lib/openai-test';

export const runtime = 'nodejs';

export async function GET() {
  const model = getDailyOpenAIModel();
  const endpoint = OPENAI_RESPONSES_ENDPOINT;

  try {
    const result = await runOpenAITest();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const details = getOpenAIErrorDetails(error, model, endpoint);

    return NextResponse.json(
      {
        ok: false,
        model,
        endpoint,
        status: details.status,
        message: details.message,
      },
      { status: details.status || 500 }
    );
  }
}
