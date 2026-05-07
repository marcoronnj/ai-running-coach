import OpenAI, { APIError } from 'openai';

export const OPENAI_RESPONSES_ENDPOINT = 'responses.create';
export const DEFAULT_DAILY_MODEL = 'gpt-5.4-mini';

export interface OpenAIErrorDetails {
  model: string;
  endpoint: string;
  status?: number;
  code?: string | null;
  type?: string;
  message: string;
}

export function getDailyOpenAIModel(): string {
  return process.env.OPENAI_MODEL_DAILY || DEFAULT_DAILY_MODEL;
}

export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY non è configurato in .env.local. ' +
      'Aggiungi la variabile di ambiente e riavvia il server.'
    );
  }

  return new OpenAI({ apiKey });
}

export function getOpenAIErrorDetails(
  error: unknown,
  model: string,
  endpoint: string
): OpenAIErrorDetails {
  if (error instanceof APIError) {
    return {
      model,
      endpoint,
      status: error.status,
      code: error.code,
      type: error.type,
      message: error.message,
    };
  }

  return {
    model,
    endpoint,
    message: error instanceof Error ? error.message : String(error),
  };
}

export function logOpenAIError(error: unknown, model: string, endpoint: string): OpenAIErrorDetails {
  const details = getOpenAIErrorDetails(error, model, endpoint);
  console.error('[OPENAI] Request failed:', details);
  return details;
}
