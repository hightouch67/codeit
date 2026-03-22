import type { FileOperation } from '../types/index.js';

// Rough token estimate: ~4 chars per token for code
const MAX_CONTEXT_CHARS = 24_000; // ~6k tokens for context, leaving room for the AI response

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
3. For existing files, use "update_file". Only use "create_file" for new files.
4. For "update_file", you MUST provide BOTH:
   - "content": the COMPLETE new file content after your changes (required, used as the reliable fallback)
   - "diff": a unified diff (--- a/path, +++ b/path, @@ ... @@) (optional but preferred for review)
5. For "create_file", provide full "content".
6. For "delete_file", only "path" is needed.
7. NEVER modify .env files, package-lock.json, or node_modules.
8. NEVER include shell commands or scripts.
9. Keep changes minimal and focused.
10. All code must be TypeScript (.ts/.tsx).
11. The "content" field for update_file must be the ENTIRE file, not just the changed section.
12. Use functional components, hooks, and TypeScript best practices.
13. Follow the existing code style and patterns in the project.

## Response Schema:
{
  "operations": [
    {
      "type": "create_file" | "update_file" | "delete_file",
      "path": "relative/path/to/file.ts",
      "content": "FULL file content (required for create_file and update_file)",
      "diff": "unified diff (optional, for update_file only)"
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
- /contexts/ – React contexts (auth, etc.)

## Example (adding a simple Button component):
{
  "operations": [
    {
      "type": "create_file",
      "path": "components/PrimaryButton.tsx",
      "content": "import React from 'react';\\nimport { TouchableOpacity, Text, StyleSheet } from 'react-native';\\nimport { spacing, fontSize, borderRadius } from '../theme';\\n\\ninterface PrimaryButtonProps {\\n  title: string;\\n  onPress: () => void;\\n  disabled?: boolean;\\n}\\n\\nexport function PrimaryButton({ title, onPress, disabled }: PrimaryButtonProps) {\\n  return (\\n    <TouchableOpacity style={[styles.btn, disabled && styles.disabled]} onPress={onPress} disabled={disabled}>\\n      <Text style={styles.text}>{title}</Text>\\n    </TouchableOpacity>\\n  );\\n}\\n\\nconst styles = StyleSheet.create({\\n  btn: { backgroundColor: '#6c5ce7', padding: spacing.md, borderRadius: borderRadius.lg, alignItems: 'center' },\\n  disabled: { opacity: 0.5 },\\n  text: { color: '#fff', fontSize: fontSize.md, fontWeight: '600' },\\n});"
    }
  ],
  "summary": "Added PrimaryButton reusable component",
  "reasoning": "Created a styled, accessible button component following existing theme patterns"
}

Respond with ONLY the JSON object. No other text.`;
}

/**
 * Builds the user prompt including project context.
 * Respects a token budget to avoid overflow.
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
    let charsUsed = 0;

    for (const [filePath, content] of Object.entries(fileContents)) {
      const block = `\n### ${filePath}\n\`\`\`\n${content}\n\`\`\`\n`;
      if (charsUsed + block.length > MAX_CONTEXT_CHARS) {
        prompt += `\n(${Object.keys(fileContents).length - Object.entries(fileContents).indexOf([filePath, content] as any)} more files omitted for brevity)\n`;
        break;
      }
      prompt += block;
      charsUsed += block.length;
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
