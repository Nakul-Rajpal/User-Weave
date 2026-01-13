/**
 * API Route: Generate Room Design from Summary
 * POST /api/meet/generate-room-design
 *
 * Generates an AI design for all users based on polling summary points
 * Creates a master chat that all users will fork
 * Requires authenticated users (host only)
 */

import { type ActionFunctionArgs, json } from '@remix-run/node';
import { createSupabaseServerClient } from '~/lib/supabase/client.server';
import { getVerifiedUser } from '~/lib/supabase/user-helpers';
import { generateId, generateText } from 'ai';
import { PROVIDER_LIST } from '~/utils/constants';
import { getSystemPrompt } from '~/lib/common/prompts/prompts';

// Helper function to generate UUID
function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const { supabase, headers } = createSupabaseServerClient(request);

  // Require authentication and verify user exists in database
  const user = await getVerifiedUser(supabase);
  if (!user) {
    return json({ error: 'Unauthorized or user record not found' }, { status: 401 });
  }

  try {
    const { roomId } = await request.json() as { roomId: string };

    // Validate input
    if (!roomId) {
      return json({ success: false, error: 'Missing roomId' }, { status: 400, headers });
    }

    console.log(`🎨 [GENERATE] Starting room design generation for room: ${roomId}`);

    // Verify user is host
    const { data: workflowData, error: workflowError } = await supabase
      .from('workflow_states')
      .select('host_user_id')
      .eq('room_id', roomId)
      .single();

    if (workflowError || !workflowData || workflowData.host_user_id !== user.id) {
      return json({ success: false, error: 'Only the host can generate room designs' }, { status: 403, headers });
    }

    console.log(`✅ [GENERATE] User verified as host: ${user.id}`);

    // Get summary points
    const { data: summaryData, error: summaryError } = await supabase
      .from('transcript_summaries')
      .select('*')
      .eq('room_id', roomId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single();

    if (summaryError || !summaryData) {
      return json({
        success: false,
        error: 'No summary found for this room. Please create a summary first.',
      }, { status: 404, headers });
    }

    const summaryPoints = summaryData.summary_points || [];

    if (summaryPoints.length === 0) {
      return json({
        success: false,
        error: 'No summary points available. Please add at least one point before generating.',
      }, { status: 400, headers });
    }

    console.log(`📝 [GENERATE] Found ${summaryPoints.length} summary points`);

    // Get or create prompt template
    let { data: template, error: templateError } = await supabase
      .from('prompt_templates')
      .select('*')
      .eq('room_id', roomId)
      .single();

    // If template doesn't exist, create default
    if (templateError || !template) {
      console.log(`🆕 [GENERATE] Creating default prompt template`);

      const defaultTemplate = `You are building a web application based on meeting requirements and discussions.

REQUIREMENTS FROM MEETING:
{SUMMARY_POINTS}

TECHNICAL SPECIFICATIONS:
- Tech Stack: {TECH_STACK}
- Design Preference: {DESIGN_PREFERENCE}
- Complexity Level: {COMPLEXITY}

Please create a complete, functional web application with:
1. Modern, responsive UI following the design preferences
2. Well-structured component architecture
3. Proper error handling and loading states
4. Clean, maintainable code
5. All necessary configuration files

Generate all necessary files to run this application immediately.`;

      const { data: created, error: createError } = await supabase
        .from('prompt_templates')
        .insert({
          room_id: roomId,
          template: defaultTemplate,
          tech_stack: 'React, TypeScript, Tailwind CSS',
          design_preference: 'Modern, Clean UI',
          complexity_level: 'Production-ready',
          updated_by: user.id,
        })
        .select()
        .single();

      if (createError) {
        console.error('❌ [GENERATE] Failed to create template:', createError);
        return json({ success: false, error: 'Failed to create prompt template' }, { status: 500, headers });
      }

      template = created;
    }

    // Build the final prompt by replacing placeholders
    const formattedPoints = summaryPoints
      .map((point: any, index: number) => `${index + 1}. [${point.category}] ${point.text}`)
      .join('\n');

    let finalPrompt = template.template
      .replace('{SUMMARY_POINTS}', formattedPoints)
      .replace('{TECH_STACK}', template.tech_stack)
      .replace('{DESIGN_PREFERENCE}', template.design_preference)
      .replace('{COMPLEXITY}', template.complexity_level);

    console.log(`📄 [GENERATE] Built final prompt (length: ${finalPrompt.length})`);

    // Create a new chat for the room design
    const chatId = generateUUID();
    const urlId = generateId();
    const chatTitle = `Room Design - ${new Date().toLocaleString()}`;

    const { error: chatError } = await supabase
      .from('chats')
      .insert({
        id: chatId,
        user_id: user.id, // Use authenticated user ID
        title: chatTitle,
        url_id: urlId,
        metadata: {
          type: 'room_design',
          room_id: roomId,
          generated_at: new Date().toISOString(),
          auto_submit_first: true, // Flag to auto-submit the first message when chat is opened
        },
      });

    if (chatError) {
      console.error('❌ [GENERATE] Failed to create chat:', chatError);
      return json({ success: false, error: 'Failed to create design chat' }, { status: 500, headers });
    }

    console.log(`💬 [GENERATE] Created chat: ${chatId}`);

    // Create initial user message with the prompt
    const messageId = generateId();

    const { error: messageError } = await supabase
      .from('messages')
      .insert({
        id: messageId,
        chat_id: chatId,
        role: 'user',
        content: finalPrompt,
        sequence: 1,
      });

    if (messageError) {
      console.error('❌ [GENERATE] Failed to create message:', messageError);
      // Rollback: delete the chat
      await supabase.from('chats').delete().eq('id', chatId);
      return json({ success: false, error: 'Failed to create initial message' }, { status: 500, headers });
    }

    console.log(`📨 [GENERATE] Created initial message: ${messageId}`);

    // Save the room design chat record
    const { data: designChat, error: designChatError } = await supabase
      .from('room_design_chats')
      .insert({
        room_id: roomId,
        chat_id: chatId,
        generated_by: user.id, // Use authenticated user ID
        prompt_used: finalPrompt,
        metadata: {
          summary_points_count: summaryPoints.length,
          template_id: template.id,
        },
      })
      .select()
      .single();

    if (designChatError) {
      console.error('❌ [GENERATE] Failed to save design chat record:', designChatError);
      // Don't rollback - the chat is still useful
    }

    // ============================================
    // Generate AI response immediately
    // ============================================
    console.log(`🤖 [GENERATE] Starting AI generation...`);

    try {
      // Use OpenAI for room design generation
      const provider = PROVIDER_LIST.find((p) => p.name === 'OpenAI');

      if (!provider) {
        throw new Error('OpenAI provider not found');
      }

      const modelName = 'gpt-4o';
      console.log(`🤖 [GENERATE] Using provider: ${provider.name}, model: ${modelName}`);

      const modelInstance = provider.getModelInstance({
        model: modelName,
        serverEnv: process.env as any,
        apiKeys: {},
        providerSettings: {},
      });

      // Generate the system prompt
      const systemPrompt = getSystemPrompt({
        cwd: '/home/project',
        allowedHtmlElements: [],
        modificationTagName: 'boltArtifact',
      });

      // Call AI to generate the design
      const { text: aiResponse } = await generateText({
        model: modelInstance,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: finalPrompt,
          },
        ],
        maxTokens: 8000,
      });

      console.log(`✅ [GENERATE] AI response generated (length: ${aiResponse.length})`);

      // Save the assistant's response
      const assistantMessageId = generateId();
      const { error: assistantMessageError } = await supabase
        .from('messages')
        .insert({
          id: assistantMessageId,
          chat_id: chatId,
          role: 'assistant',
          content: aiResponse,
          sequence: 2,
        });

      if (assistantMessageError) {
        console.error('❌ [GENERATE] Failed to save assistant message:', assistantMessageError);
        // Continue anyway - the chat is still useful even without the AI response
      } else {
        console.log(`💾 [GENERATE] Saved assistant response: ${assistantMessageId}`);
      }

      // Update chat metadata to indicate AI generation is complete
      await supabase
        .from('chats')
        .update({
          metadata: {
            type: 'room_design',
            room_id: roomId,
            generated_at: new Date().toISOString(),
            auto_submit_first: false, // No need to auto-submit - response already generated
            ai_generated: true,
          },
        })
        .eq('id', chatId);

    } catch (aiError: any) {
      console.error('❌ [GENERATE] AI generation failed:', aiError);
      // Continue anyway - users can still fork and try again
      return json({
        success: false,
        error: `AI generation failed: ${aiError.message}. Please try again.`,
      }, { status: 500, headers });
    }

    console.log(`✅ [GENERATE] Room design generation completed successfully`);

    return json({
      success: true,
      chatId: urlId, // Return URL-friendly ID for navigation
      designChatId: designChat?.id,
      message: 'Room design generated successfully. Users can now view it.',
    }, { headers });
  } catch (error: any) {
    console.error('❌ [GENERATE] Failed to generate room design:', error);
    return json(
      {
        success: false,
        error: error.message || 'Failed to generate room design',
      },
      { status: 500, headers }
    );
  }
}
