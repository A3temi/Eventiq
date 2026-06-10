import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import { type AgentType, AGENT_MODEL_MAP } from '@/types/agents';

/**
 * AI Gateway — routes all LLM calls through AWS Bedrock.
 *
 * Model strategy:
 * - Orchestrator (intent parsing, complex reasoning): Claude Sonnet on Bedrock
 * - Sub-agents (structured extraction, templates): Claude Haiku on Bedrock (cheap, fast)
 * - Payment/Attendee: No LLM (pure business logic)
 *
 * All models run on AWS — no external API keys needed beyond AWS credentials.
 */

const bedrock = createAmazonBedrock({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

export type ModelProvider = 'bedrock';

export interface ModelConfig {
  provider: ModelProvider;
  modelId: string;
  maxOutputTokens: number;
  temperature: number;
}

const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'bedrock/claude-sonnet': {
    provider: 'bedrock',
    modelId: 'anthropic.claude-sonnet-4-20250514-v1:0',
    maxOutputTokens: 4096,
    temperature: 0.3,
  },
  'bedrock/claude-haiku': {
    provider: 'bedrock',
    modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
    maxOutputTokens: 4096,
    temperature: 0.2,
  },
};

// Map agent types to Bedrock models
const AGENT_BEDROCK_MAP: Record<AgentType | 'orchestrator', string> = {
  orchestrator: 'bedrock/claude-sonnet',
  venue: 'bedrock/claude-haiku',
  vendor: 'bedrock/claude-haiku',
  food: 'bedrock/claude-haiku',
  payment: 'none',
  communication: 'bedrock/claude-haiku',
  attendee: 'none',
  schedule: 'bedrock/claude-haiku',
  analytics: 'bedrock/claude-haiku',
};

/**
 * Get the appropriate language model instance for a given agent.
 * Returns null for agents that don't need LLM (payment, attendee).
 */
export function getModelForAgent(agentType: AgentType | 'orchestrator') {
  const modelKey = AGENT_BEDROCK_MAP[agentType];

  if (modelKey === 'none') {
    return null;
  }

  const config = MODEL_CONFIGS[modelKey];
  if (!config) {
    return bedrock('anthropic.claude-3-haiku-20240307-v1:0');
  }

  return bedrock(config.modelId);
}

/**
 * Get model config for an agent (useful for setting generation params).
 */
export function getModelConfig(agentType: AgentType | 'orchestrator'): ModelConfig | null {
  const modelKey = AGENT_BEDROCK_MAP[agentType];
  if (modelKey === 'none') return null;
  return MODEL_CONFIGS[modelKey] || MODEL_CONFIGS['bedrock/claude-haiku'];
}

/**
 * Primary model for high-stakes reasoning (orchestrator).
 * Claude Sonnet on AWS Bedrock.
 */
export const primaryModel = bedrock('anthropic.claude-sonnet-4-20250514-v1:0');

/**
 * Fast/cheap model for structured extraction tasks.
 * Claude Haiku on AWS Bedrock.
 */
export const fastModel = bedrock('anthropic.claude-3-haiku-20240307-v1:0');

/**
 * Fallback model if primary fails.
 */
export const fallbackModel = bedrock('anthropic.claude-3-haiku-20240307-v1:0');
