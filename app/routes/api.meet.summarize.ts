/**
 * API Route: Generate AI Summary from Meeting Transcript
 * POST /api/meet/summarize
 *
 * Fetches the transcript for a room, sends it to an LLM for summarization,
 * and stores the resulting summary points in the database.
 */

import { type ActionFunctionArgs } from '@remix-run/node';
import { createClient } from '@supabase/supabase-js';
import { generateText } from 'ai';
import { LLMManager } from '~/lib/modules/llm/manager';
import { getApiKeysFromCookie, getProviderSettingsFromCookie } from '~/lib/api/cookies';
import { PROVIDER_LIST } from '~/utils/constants';

/**
 * Exported function to generate design implications from transcript
 * Can be called from other API routes
 */
export async function generateDesignImplications(
  roomId: string,
  authHeader: string | null = null,
  cookieHeader: string | null = null,
  context?: any
) {
  // Initialize Supabase client
  const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Collect debug information to return in case of errors
  const debugInfo: any = {
    timestamp: new Date().toISOString(),
    environment: 'render',
  };

  console.log(`🤖 Generating summary for room: ${roomId}`);

  // Get API keys and provider settings from cookies
  const apiKeys = getApiKeysFromCookie(cookieHeader);
  const providerSettings = getProviderSettingsFromCookie(cookieHeader);

  // Get the current user from Supabase session
  let userId: string | null = null;

  if (authHeader) {
    const {
      data: { user },
    } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    userId = user?.id || null;
  }

  // ========== DEBUG: Environment Variable Access ==========
  debugInfo.contextType = typeof context;
  debugInfo.contextEnvExists = !!context?.env;
  debugInfo.contextEnvKeys = context?.env ? Object.keys(context.env) : [];

  console.log('🔍 DEBUG - Context object type:', typeof context);
  console.log('🔍 DEBUG - Context.env exists:', !!context?.env);
  console.log('🔍 DEBUG - Context.env keys:', context?.env ? Object.keys(context.env) : 'N/A');

  // Log process.env availability (mask sensitive values)
  const processEnvAvailable = typeof process !== 'undefined' && typeof process.env !== 'undefined';
  debugInfo.processEnvAvailable = processEnvAvailable;

  console.log('🔍 DEBUG - process.env available:', processEnvAvailable);
  if (typeof process !== 'undefined' && process.env) {
    const envKeys = Object.keys(process.env).filter(key =>
      key.includes('OPENAI') ||
      key.includes('ANTHROPIC') ||
      key.includes('SUPABASE') ||
      key.includes('VITE_')
    );
    debugInfo.processEnvKeys = envKeys;
    debugInfo.openaiKeyInProcessEnv = !!process.env.OPENAI_API_KEY;
    debugInfo.anthropicKeyInProcessEnv = !!process.env.ANTHROPIC_API_KEY;

    console.log('🔍 DEBUG - Relevant process.env keys:', envKeys);
    console.log('🔍 DEBUG - OPENAI_API_KEY in process.env:', !!process.env.OPENAI_API_KEY);
    console.log('🔍 DEBUG - ANTHROPIC_API_KEY in process.env:', !!process.env.ANTHROPIC_API_KEY);
  }

  // Merge environment variables from all sources
  // Vercel/Remix provides env through context.env on production
  // process.env is available in Vercel serverless functions
  // Note: process.env doesn't spread correctly, so we explicitly pick needed keys
  const serverEnv: Record<string, string | undefined> = {
    ...context?.env,      // Vercel production (if available)
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    SUPABASE_URL: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };

  const mergedEnvKeys = Object.keys(serverEnv).filter(key =>
    key.includes('OPENAI') ||
    key.includes('ANTHROPIC') ||
    key.includes('SUPABASE') ||
    key.includes('VITE_')
  );
  debugInfo.mergedServerEnvKeys = mergedEnvKeys;
  debugInfo.openaiKeyInServerEnv = !!serverEnv.OPENAI_API_KEY;
  debugInfo.anthropicKeyInServerEnv = !!serverEnv.ANTHROPIC_API_KEY;

  console.log('🔍 DEBUG - Merged serverEnv keys:', mergedEnvKeys);
  console.log('🔍 DEBUG - OPENAI_API_KEY in serverEnv:', !!serverEnv.OPENAI_API_KEY);
  console.log('🔍 DEBUG - ANTHROPIC_API_KEY in serverEnv:', !!serverEnv.ANTHROPIC_API_KEY);
  // ========== END DEBUG ==========

  // Fetch the most recent transcript for this room
  const { data: transcriptData, error: transcriptError } = await supabase
    .from('meeting_transcripts')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (transcriptError || !transcriptData) {
    throw new Error('No transcript found for this room');
  }

  console.log(`📄 Found transcript with ${transcriptData.transcript_data.length} entries`);

  // Format transcript for LLM
  const transcriptText = transcriptData.transcript_data
    .map((entry: any) => {
      const participant = entry.participant || 'Unknown';
      return `[${entry.timestamp}] ${participant}: ${entry.text}`;
    })
    .join('\n');

  // Create design implications prompt (updated to request exactly 10 points)
  const prompt = `You are an AI assistant helping to extract design implications from a meeting transcript.

Analyze the following meeting transcript and generate EXACTLY 10 structured design implications that will guide the implementation of a web application or digital product.

Categorize each point as one of:
- "decision": A design decision that was made (architecture, technology choices, UI patterns)
- "action": A design task or implementation item to be done
- "discussion": A design consideration or trade-off that was discussed
- "question": An open design question that needs resolution

Return the design implications as a JSON array of objects with this structure:
[
  {
    "id": "unique-id-1",
    "text": "Brief description of the design implication",
    "category": "decision"
  },
  ...
]

Important:
- Generate EXACTLY 10 design implications, no more, no less
- Focus on design-relevant information (architecture, UI/UX, features, technical decisions)
- Use simple sequential IDs like "point-1", "point-2", etc.
- Keep each point concise (1-2 sentences max)
- Focus on actionable design implications that will guide implementation
- Ensure you have a good distribution of categories

Meeting Transcript:
${transcriptText}

Return ONLY the JSON array, no additional text.`;

  // ========== DEBUG: LLM Provider Initialization ==========
  debugInfo.apiKeysFromCookies = apiKeys ? Object.keys(apiKeys) : [];
  debugInfo.providerSettingsFromCookies = providerSettings ? Object.keys(providerSettings) : [];

  console.log('🔍 DEBUG - Initializing LLM Manager...');
  console.log('🔍 DEBUG - API keys from cookies:', apiKeys ? Object.keys(apiKeys) : 'None');
  console.log('🔍 DEBUG - Provider settings from cookies:', providerSettings ? Object.keys(providerSettings) : 'None');
  // ========== END DEBUG ==========

  // Get LLM Manager and find available provider
  const llmManager = LLMManager.getInstance(serverEnv as any);
  console.log('🔍 DEBUG - LLM Manager instance created');

  // Don't pass providerSettings if we have server-side API keys
  // This prevents cookie-based provider settings from filtering out available providers
  const hasServerKeys = !!serverEnv?.OPENAI_API_KEY || !!serverEnv?.ANTHROPIC_API_KEY;
  const effectiveProviderSettings = hasServerKeys ? undefined : providerSettings;

  await llmManager.updateModelList({ apiKeys, providerSettings: effectiveProviderSettings, serverEnv: serverEnv as any });
  console.log('🔍 DEBUG - Model list updated (hasServerKeys:', hasServerKeys, ')');

  const models = llmManager.getModelList();
  debugInfo.totalModelsAvailable = models.length;
  debugInfo.availableProviders = [...new Set(models.map(m => m.provider))];

  console.log('🔍 DEBUG - Total models available:', models.length);
  console.log('🔍 DEBUG - Available providers:', [...new Set(models.map(m => m.provider))]);

  // Log sample models per provider
  const modelsByProvider = models.reduce((acc, model) => {
    if (!acc[model.provider]) acc[model.provider] = [];
    acc[model.provider].push(model.name);
    return acc;
  }, {} as Record<string, string[]>);
  debugInfo.modelsByProvider = modelsByProvider;

  console.log('🔍 DEBUG - Models by provider:', JSON.stringify(modelsByProvider, null, 2));

  // Check which providers have valid API keys
  const hasAnthropicKey = apiKeys?.['Anthropic'] ||
                         serverEnv?.ANTHROPIC_API_KEY;

  const hasOpenAIKey = apiKeys?.['OpenAI'] ||
                      serverEnv?.OPENAI_API_KEY;

  debugInfo.apiKeyDetection = {
    anthropicFromCookies: !!apiKeys?.['Anthropic'],
    anthropicFromServerEnv: !!serverEnv?.ANTHROPIC_API_KEY,
    anthropicFinal: !!hasAnthropicKey,
    openaiFromCookies: !!apiKeys?.['OpenAI'],
    openaiFromServerEnv: !!serverEnv?.OPENAI_API_KEY,
    openaiFinal: !!hasOpenAIKey
  };

  console.log('🔑 API Key Detection:', debugInfo.apiKeyDetection);

  // ========== DEBUG: Model Selection ==========
  console.log('🔍 DEBUG - Starting model selection...');
  // ========== END DEBUG ==========

  // Select model based on available API keys
  // Priority: OpenAI first (for transcription consistency), then Anthropic as fallback
  let preferredModel;

  // Try OpenAI first if API key exists
  if (hasOpenAIKey) {
    console.log('🔍 DEBUG - Attempting to select OpenAI model...');
    const openaiModels = models.filter(m => m.provider === 'OpenAI');
    console.log('🔍 DEBUG - Available OpenAI models:', openaiModels.map(m => m.name));

    preferredModel = models.find(m =>
      m.provider === 'OpenAI' && (
        m.name.includes('gpt-4o') ||
        m.name.includes('gpt-4-turbo') ||
        m.name.includes('gpt-4')
      )
    );

    if (preferredModel) {
      console.log('✅ Using OpenAI model (OpenAI API key available):', preferredModel.name);
    } else {
      console.log('⚠️  DEBUG - No suitable OpenAI model found in available models');
    }
  } else {
    console.log('🔍 DEBUG - Skipping OpenAI (no API key)');
  }

  // Fallback to Anthropic (Claude) if OpenAI not found or no key
  if (!preferredModel && hasAnthropicKey) {
    console.log('🔍 DEBUG - Attempting to select Anthropic model...');
    const anthropicModels = models.filter(m => m.provider === 'Anthropic');
    console.log('🔍 DEBUG - Available Anthropic models:', anthropicModels.map(m => m.name));

    preferredModel = models.find(m =>
      m.provider === 'Anthropic' && (
        m.name.includes('claude-3-5-sonnet') ||
        m.name.includes('claude-3-sonnet')
      )
    );

    if (preferredModel) {
      console.log('✅ Using Claude model (OpenAI unavailable, using Anthropic fallback):', preferredModel.name);
    } else {
      console.log('⚠️  DEBUG - No suitable Claude model found in available models');
    }
  } else if (!preferredModel) {
    console.log('🔍 DEBUG - Skipping Anthropic (no API key)');
  }

  if (!preferredModel) {
    console.error('❌ ERROR - No suitable LLM model found!');
    console.error('❌ Available models:', models.length);
    console.error('❌ Has OpenAI key:', !!hasOpenAIKey);
    console.error('❌ Has Anthropic key:', !!hasAnthropicKey);
    throw new Error('No suitable LLM model found. Please configure either OpenAI (GPT-4) or Anthropic (Claude) API keys in your settings.');
  }

  const providerInfo = PROVIDER_LIST.find((p) => p.name === preferredModel.provider);

  if (!providerInfo) {
    throw new Error('Provider not found');
  }

  console.log(`🤖 Using model: ${preferredModel.name} from ${preferredModel.provider}`);

  const modelInstance = providerInfo.getModelInstance({
    model: preferredModel.name,
    serverEnv: serverEnv as any,
    apiKeys,
    providerSettings,
  });

  // Generate summary using LLM (non-streaming for easier JSON parsing)
  console.log('🤖 Calling LLM for summarization...');

  const result = await generateText({
    model: modelInstance,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: 0.3, // Lower temperature for more focused output
    maxTokens: 4000,
  });

  const fullResponse = result.text;
  console.log('✅ LLM response received');

  // Parse the JSON response
  let summaryPoints;
  try {
    // Extract JSON from response (in case there's extra text)
    const jsonMatch = fullResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in response');
    }
    summaryPoints = JSON.parse(jsonMatch[0]);
  } catch (parseError) {
    console.error('Failed to parse LLM response:', fullResponse);
    throw new Error('Failed to parse summary from LLM response');
  }

  // Validate the structure
  if (!Array.isArray(summaryPoints)) {
    throw new Error('Summary is not an array');
  }

  // Ensure exactly 10 points
  if (summaryPoints.length !== 10) {
    console.warn(`⚠️  LLM generated ${summaryPoints.length} points instead of 10. Adjusting...`);
    if (summaryPoints.length > 10) {
      summaryPoints = summaryPoints.slice(0, 10);
    }
  }

  // Save summary to database
  const { data: summaryData, error: summaryError } = await supabase
    .from('transcript_summaries')
    .insert({
      room_id: roomId,
      summary_points: summaryPoints,
      llm_model: preferredModel.name,
      generated_by_user_id: userId,
    })
    .select()
    .single();

  if (summaryError) {
    console.error('Error saving summary:', summaryError);
    throw summaryError;
  }

  console.log(`✅ Summary saved with ID: ${summaryData.id}`);

  return {
    success: true,
    summaryId: summaryData.id,
    summary: summaryData,
    pointCount: summaryPoints.length,
  };
}

export async function action({ request, context }: ActionFunctionArgs) {
  try {
    const { roomId } = await request.json();

    // Get headers for passing to the shared function
    const authHeader = request.headers.get('Authorization');
    const cookieHeader = request.headers.get('Cookie');

    // Call the shared function
    const result = await generateDesignImplications(roomId, authHeader, cookieHeader, context);

    return new Response(
      JSON.stringify(result),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Failed to generate summary:', error);

    return new Response(
      JSON.stringify({
        success: false,
        message: error.message || 'Failed to generate summary',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
