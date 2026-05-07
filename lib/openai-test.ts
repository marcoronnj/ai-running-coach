import {
  getDailyOpenAIModel,
  getOpenAIClient,
  logOpenAIError,
  OPENAI_RESPONSES_ENDPOINT,
} from './openai-client';

export interface OpenAITestResult {
  ok: true;
  model: string;
  response: string;
}

export async function runOpenAITest(): Promise<OpenAITestResult> {
  const client = getOpenAIClient();
  const model = getDailyOpenAIModel();
  const endpoint = OPENAI_RESPONSES_ENDPOINT;

  try {
    console.log('[OPENAI-TEST] Running debug prompt...', { model, endpoint });

    const result = await client.responses.create({
      model,
      input: 'Say OK',
      max_output_tokens: 16,
    });

    const response = result.output_text.trim();

    if (!response) {
      throw new Error('OpenAI non ha restituito contenuto');
    }

    return {
      ok: true,
      model,
      response,
    };
  } catch (error) {
    logOpenAIError(error, model, endpoint);
    throw error;
  }
}
