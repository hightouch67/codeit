import type { FileOperation } from '../types/index.js';

/**
 * Builds the system prompt for our AI agent.
 * This constrains the AI to return ONLY valid JSON with file operations.
 */
export function buildSystemPrompt(): string {
  return `You are a senior React Native / Expo developer AI agent.

Your ONLY job is to return JSON that describes file operations to apply to a React Native Expo project.

## STRICT RULES:
1. You MUST return ONLY valid JSON. No markdown, no explanation outside JSON.
2. You MUST use the exact schema below.
3. For existing files, prefer "update_file" with a unified diff patch. Only use "create_file" for new files.
4. For "update_file", provide a "diff" field with a unified diff (--- a/path, +++ b/path, @@ ... @@).
5. For "create_file", provide full "content".
6. For "delete_file", only "path" is needed.
7. NEVER modify .env files, package-lock.json, or node_modules.
8. NEVER include shell commands or scripts.
9. Keep changes minimal and focused.
10. All code must be TypeScript (.ts/.tsx).

## Response Schema:
{
  "operations": [
    {
      "type": "create_file" | "update_file" | "delete_file",
      "path": "relative/path/to/file.ts",
      "content": "full file content (for create_file)",
      "diff": "unified diff (for update_file)"
    }
  ],
  "summary": "brief description of changes made",
  "reasoning": "optional: why these changes were made"
}

## Project structure:
- /components/ – Reusable React Native components
- /screens/ – Screen components
- /hooks/ – Custom React hooks
- /services/ – API and business logic services
- /navigation/ – Navigation configuration
- /theme/ – Colors, spacing, typography
- /utils/ – Utility functions
- /app/ – Expo Router pages

Respond with ONLY the JSON object. No other text.`;
}

/**
 * Builds the user prompt including project context.
 */
export function buildUserPrompt(
  userRequest: string,
  existingFiles: string[],
  fileContents?: Record<string, string>,
): string {
  let prompt = `## User Request:\n${userRequest}\n\n`;

  prompt += `## Existing files in the project:\n`;
  prompt += existingFiles.map((f) => `- ${f}`).join('\n');
  prompt += '\n\n';

  if (fileContents && Object.keys(fileContents).length > 0) {
    prompt += `## Relevant file contents:\n`;
    for (const [filePath, content] of Object.entries(fileContents)) {
      prompt += `\n### ${filePath}\n\`\`\`\n${content}\n\`\`\`\n`;
    }
  }

  prompt += `\nRespond with ONLY the JSON object following the schema from your system instructions.`;
  return prompt;
}

/**
 * Extracts JSON from an AI response that might have extra text around it.
 */
export function extractJsonFromResponse(raw: string): string {
  // Try to parse directly first
  const trimmed = raw.trim();
  if (trimmed.startsWith('{')) {
    // Find the matching closing brace
    let depth = 0;
    for (let i = 0; i < trimmed.length; i++) {
      if (trimmed[i] === '{') depth++;
      if (trimmed[i] === '}') depth--;
      if (depth === 0) {
        return trimmed.substring(0, i + 1);
      }
    }
  }

  // Try to extract from markdown code block
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Last resort: find first { and last }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.substring(firstBrace, lastBrace + 1);
  }

  throw new Error('Could not extract JSON from AI response');
}
