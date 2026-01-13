/**
 * API Route: Generate AI Summary from Meeting Transcript
 * POST /api/meet/summarize
 *
 * Fetches the transcript for a room, sends it to an LLM for summarization,
 * and stores the resulting summary points in the database.
 */

import { type ActionFunctionArgs, json } from '@remix-run/node';
import { createClient } from '@supabase/supabase-js';
import { generateText } from 'ai';
import { LLMManager } from '~/lib/modules/llm/manager';
import { getApiKeysFromCookie, getProviderSettingsFromCookie } from '~/lib/api/cookies';
import { PROVIDER_LIST } from '~/utils/constants';

// Initialize Supabase client (server-side)
const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface AppContext {
  env?: Record<string, string>;
}

export async function action({ request, context }: ActionFunctionArgs & { context: AppContext }) {
  // Collect debug information to return in case of errors
  const debugInfo: any = {
    timestamp: new Date().toISOString(),
    environment: 'vercel',
  };

  try {
    const { roomId } = await request.json();

    console.log(`🤖 Generating summary for room: ${roomId}`);

    // Get API keys and provider settings from cookies
    const cookieHeader = request.headers.get('Cookie');
    const apiKeys = getApiKeysFromCookie(cookieHeader);
    const providerSettings = getProviderSettingsFromCookie(cookieHeader);

    // Get the current user from Supabase session
    const authHeader = request.headers.get('Authorization');
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
    const serverEnv = {
      ...context.env,      // Vercel production (if available)
      ...process.env,      // Takes precedence - Vercel runtime env
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

    // Create summarization prompt
    const prompt = `You are an AI assistant helping to summarize a meeting transcript.

Analyze the following meeting transcript and generate a structured summary with bullet points.

Categorize each point as one of:
- "decision": A decision that was made
- "action": An action item or task to be done
- "discussion": A topic that was discussed
- "question": A question that was raised

Return the summary as a JSON array of objects with this structure:
[
  {
    "id": "unique-id-1",
    "text": "Brief summary of the point",
    "category": "decision"
  },
  ...
]

Important:
- Use simple sequential IDs like "point-1", "point-2", etc.
- Keep each point concise (1-2 sentences max)
- Focus on actionable and important information
- Limit to 10-15 key points total

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

    await llmManager.updateModelList({ apiKeys, providerSettings, serverEnv: serverEnv as any });
    console.log('🔍 DEBUG - Model list updated');

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
    let preferredModel;

    // Try Claude first if API key exists
    if (hasAnthropicKey) {
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
        console.log('✅ Using Claude model (Anthropic API key available):', preferredModel.name);
      } else {
        console.log('⚠️  DEBUG - No suitable Claude model found in available models');
      }
    } else {
      console.log('🔍 DEBUG - Skipping Anthropic (no API key)');
    }

    // Fallback to OpenAI if Claude not found or no key
    if (!preferredModel && hasOpenAIKey) {
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
        console.log('✅ Using OpenAI model (Claude unavailable, using OpenAI fallback):', preferredModel.name);
      } else {
        console.log('⚠️  DEBUG - No suitable OpenAI model found in available models');
      }
    } else if (!preferredModel) {
      console.log('🔍 DEBUG - Skipping OpenAI (no API key)');
    }

    if (!preferredModel) {
      console.error('❌ ERROR - No suitable LLM model found!');
      console.error('❌ Available models:', models.length);
      console.error('❌ Has Anthropic key:', !!hasAnthropicKey);
      console.error('❌ Has OpenAI key:', !!hasOpenAIKey);
      throw new Error('No suitable LLM model found. Please configure either Anthropic (Claude) or OpenAI (GPT-4) API keys in your settings.');
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

    return json({
      success: true,
      summaryId: summaryData.id,
      summary: summaryData,
      pointCount: summaryPoints.length,
    });
  } catch (error: any) {
    console.error('Failed to generate summary:', error);
    console.error('Debug info at error:', JSON.stringify(debugInfo, null, 2));

    return json(
      {
        success: false,
        message: error.message || 'Failed to generate summary',
        debug: debugInfo, // Include debug info in error response for client visibility
      },
      { status: 500 }
    );
  }
}
