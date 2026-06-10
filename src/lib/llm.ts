import { ChatBedrockConverse } from '@langchain/aws';

/**
 * LLM Factory — creates the right model client based on env config.
 *
 * When USE_VERCEL_AI_GATEWAY=true:
 *   Uses Vercel AI Gateway (dynamic import of @langchain/openai)
 *
 * When USE_VERCEL_AI_GATEWAY=false (default):
 *   Uses AWS Bedrock directly
 */

function useGateway(): boolean {
  return process.env.USE_VERCEL_AI_GATEWAY === 'true';
}

/**
 * Create the primary/orchestrator model (Claude Sonnet).
 */
export function createPrimaryLLM(): any {
  if (useGateway()) {
    // Dynamic require to avoid OPENAI_API_KEY check at import time
    const { ChatOpenAI } = require('@langchain/openai');
    return new ChatOpenAI({
      modelName: process.env.AI_PRIMARY_MODEL || 'anthropic/claude-sonnet-4-20250514',
      openAIApiKey: process.env.VERCEL_AI_GATEWAY_API_KEY!,
      configuration: {
        baseURL: 'https://gateway.vercel.ai/v1',
      },
      temperature: 0.3,
      maxTokens: 4096,
    });
  }

  return new ChatBedrockConverse({
    model: 'us.anthropic.claude-sonnet-4-20250514-v1:0',
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
    temperature: 0.3,
    maxTokens: 4096,
  });
}

/**
 * Create the fast/cheap model (Claude Haiku).
 */
export function createFastLLM(): any {
  if (useGateway()) {
    const { ChatOpenAI } = require('@langchain/openai');
    return new ChatOpenAI({
      modelName: process.env.AI_FAST_MODEL || 'anthropic/claude-3-haiku-20240307',
      openAIApiKey: process.env.VERCEL_AI_GATEWAY_API_KEY!,
      configuration: {
        baseURL: 'https://gateway.vercel.ai/v1',
      },
      temperature: 0.2,
      maxTokens: 2048,
    });
  }

  return new ChatBedrockConverse({
    model: 'us.anthropic.claude-3-haiku-20240307-v1:0',
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
    temperature: 0.2,
    maxTokens: 2048,
  });
}
