import { env } from '../config/index.js';
import { aiResponseSchema, validateOperation } from '../validators/index.js';
import { buildSystemPrompt, buildUserPrompt, extractJsonFromResponse } from './prompt-builder.js';
import type { AIResponse } from '../types/index.js';

interface CallAIOptions {
  userPrompt: string;
  existingFiles: string[];
  fileContents?: Record<string, string>;
}

/**
 * Call the AI model (OpenAI-compatible API — works with Ollama, vLLM, llama.cpp, etc.)
 */
async function callAIModel(systemPrompt: string, userPrompt: string): Promise<string> {
  const url = `${env.AI_BASE_URL}/v1/chat/completions`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (env.AI_API_KEY) {
    headers['Authorization'] = `Bearer ${env.AI_API_KEY}`;
  }

  const body = {
    model: env.AI_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.2,
    max_tokens: 8192,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`AI API error ${res.status}: ${errText}`);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('AI returned empty response');
  }

  return content;
}

/**
 * Parse and validate the AI response.
 */
function parseAIResponse(raw: string): AIResponse {
  const jsonStr = extractJsonFromResponse(raw);
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(`Failed to parse AI JSON: ${jsonStr.substring(0, 200)}`);
  }

  const validated = aiResponseSchema.parse(parsed);

  // Validate each operation's file path
  for (const op of validated.operations) {
    const check = validateOperation(op);
    if (!check.valid) {
      throw new Error(`Invalid operation: ${check.reason}`);
    }
  }

  return validated as AIResponse;
}

/**
 * Main entry: call AI with retry logic.
 */
export async function executeAI(options: CallAIOptions): Promise<AIResponse> {
  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(options.userPrompt, options.existingFiles, options.fileContents);
  const maxRetries = env.MAX_RETRIES;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[AI] Attempt ${attempt + 1}/${maxRetries + 1}`);
      const rawResponse = await callAIModel(systemPrompt, userPrompt);
      const result = parseAIResponse(rawResponse);
      console.log(`[AI] Success: ${result.operations.length} operations, summary: ${result.summary}`);
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`[AI] Attempt ${attempt + 1} failed: ${lastError.message}`);

      if (attempt < maxRetries) {
        // Wait before retrying (exponential backoff)
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  throw new Error(`AI failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
}
