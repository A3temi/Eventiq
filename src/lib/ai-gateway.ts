import { ChatOpenAI } from '@langchain/openai';

/**
 * Create a Vercel AI Gateway LLM instance.
 * Routes through Vercel's gateway for caching, rate limiting, and observability.
 * Falls back to null if gateway key is not set (caller should use Bedrock instead).
 */
export function createGatewayLLM(model: string = 'anthropic/claude-sonnet-4-20250514') {
  const apiKey = process.env.VERCEL_AI_GATEWAY_API_KEY;

  if (!apiKey) return null; // Fall back to Bedrock

  return new ChatOpenAI({
    modelName: model,
    openAIApiKey: apiKey,
    configuration: {
      baseURL: 'https://gateway.vercel.ai/v1',
    },
    temperature: 0.3,
    maxTokens: 4096,
  });
}
