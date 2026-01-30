import { generateId, type Message } from 'ai';
import { supabase } from '~/lib/supabase/client';
import type { Database } from '~/lib/supabase/client';
import { verifyUserExists } from '~/lib/supabase/user-helpers';

/**
 * Client-side helper to get verified user
 * Ensures user exists in both auth.users and public.users tables
 */
async function getVerifiedUser() {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  // Verify user exists in database
  try {
    await verifyUserExists(supabase, user.id);
    return user;
  } catch (err) {
    console.error('🔐 [PERSISTENCE] User exists in auth but not in database:', {
      userId: user.id,
      email: user.email,
      error: err,
    });
    return null;
  }
}

// Generate a valid UUID for database IDs
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

export type ChatHistoryItem = {
  id: string;
  urlId?: string;
  description?: string;
  messages: Message[];
  timestamp: string;
  metadata?: Database['public']['Tables']['chats']['Row']['metadata'];
};

export async function getAllChats(): Promise<ChatHistoryItem[]> {
  const user = await getVerifiedUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data: chats, error } = await supabase
    .from('chats')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch chats: ${error.message}`);
  }

  // Convert to ChatHistoryItem format
  return chats.map(chat => ({
    id: chat.id,
    urlId: chat.url_id || undefined,
    description: chat.title || undefined,
    messages: [], // We'll load messages separately when needed
    timestamp: chat.created_at,
    metadata: chat.metadata,
  }));
}

export async function getChatById(chatId: string): Promise<ChatHistoryItem | null> {
  console.log('📖 [LOAD] Starting getChatById:', { chatId });

  const user = await getVerifiedUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // First try to get chat by id (UUID)
  let { data: chat, error: chatError } = await supabase
    .from('chats')
    .select('*')
    .eq('id', chatId)
    .eq('user_id', user.id)
    .single();

  console.log('📖 [LOAD] Chat lookup by ID:', { found: !!chat, error: chatError?.message });

  // If not found and chatId looks like a url_id (not a UUID), try by url_id
  if ((!chat || chatError) && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chatId)) {
    console.log('📖 [LOAD] Trying lookup by url_id...');
    const result = await supabase
      .from('chats')
      .select('*')
      .eq('url_id', chatId)
      .eq('user_id', user.id)
      .single();
    chat = result.data;
    chatError = result.error;
    console.log('📖 [LOAD] Chat lookup by url_id:', { found: !!chat });
  }

  if (chatError || !chat) {
    console.log('❌ [LOAD] Chat not found');
    return null;
  }

  // Get messages
  console.log('📖 [LOAD] Fetching messages for chat:', chat.id);
  const { data: messages, error: messagesError } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chat.id)
    .order('sequence', { ascending: true });

  if (messagesError) {
    console.error('❌ [LOAD] Error fetching messages:', messagesError);
    throw new Error(`Failed to fetch messages: ${messagesError.message}`);
  }

  console.log('📖 [LOAD] Loaded messages:', {
    count: messages.length,
    ids: messages.map(m => m.id),
    sequences: messages.map(m => m.sequence),
    roles: messages.map(m => m.role),
  });

  return {
    id: chat.id,
    urlId: chat.url_id || undefined,
    description: chat.title || undefined,
    messages: messages
      .map(msg => {
        let annotations;
        try {
          annotations = msg.annotations ? JSON.parse(msg.annotations) : undefined;
        } catch (e) {
          console.error('Error parsing annotations:', e);
          annotations = undefined;
        }

        return {
          id: msg.id,
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
          createdAt: new Date(msg.created_at),
          annotations,
        };
      })
      .filter(msg => msg.role !== 'system'),
    timestamp: chat.created_at,
    metadata: chat.metadata,
  };
}

export async function getChatByUrlId(urlId: string): Promise<ChatHistoryItem | null> {

  const user = await getVerifiedUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Get chat info by url_id
  const { data: chat, error: chatError } = await supabase
    .from('chats')
    .select('*')
    .eq('url_id', urlId)
    .eq('user_id', user.id)
    .single();

  if (chatError || !chat) {
    return null;
  }

  // Get messages
  const { data: messages, error: messagesError } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chat.id)
    .order('sequence', { ascending: true });

  if (messagesError) {
    throw new Error(`Failed to fetch messages: ${messagesError.message}`);
  }

  return {
    id: chat.id,
    urlId: chat.url_id || undefined,
    description: chat.title || undefined,
    messages: messages
      .map(msg => {
        let annotations;
        try {
          annotations = msg.annotations ? JSON.parse(msg.annotations) : undefined;
        } catch (e) {
          console.error('Error parsing annotations:', e);
          annotations = undefined;
        }

        return {
          id: msg.id,
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
          createdAt: new Date(msg.created_at),
          annotations,
        };
      })
      .filter(msg => msg.role !== 'system'),
    timestamp: chat.created_at,
    metadata: chat.metadata,
  };
}

export async function saveChat(
  chatId: string,
  messages: Message[],
  urlId?: string,
  description?: string,
  metadata?: any,
): Promise<void> {
  console.log('💾 [SAVE] Starting saveChat:', {
    chatId,
    messageCount: messages.length,
    urlId,
    description,
    messageIds: messages.map(m => m.id),
    messageRoles: messages.map(m => m.role),
  });

  const user = await getVerifiedUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Check if chat exists
  const { data: existingChat } = await supabase
    .from('chats')
    .select('id')
    .eq('id', chatId)
    .eq('user_id', user.id)
    .single();

  console.log('💾 [SAVE] Chat exists check:', { exists: !!existingChat });

    if (!existingChat) {
      // Try to create new chat
      const { error: chatError } = await supabase
        .from('chats')
        .insert({
          id: chatId,
          user_id: user.id,
          title: description,
          url_id: urlId,
          metadata,
        });

      if (chatError) {
        // If duplicate key error, try updating instead
        if (chatError.code === '23505') {
          console.log('Chat already exists, updating instead');
          const { error: updateError } = await supabase
            .from('chats')
            .update({
              title: description,
              url_id: urlId,
              metadata,
            })
            .eq('id', chatId)
            .eq('user_id', user.id);

          if (updateError) {
            console.error('Error updating chat:', updateError);
            throw new Error(`Failed to update chat: ${updateError.message}`);
          }
        } else {
          console.error('Error creating chat:', chatError);
          throw new Error(`Failed to create chat: ${chatError.message}`);
        }
      }
    } else {
      // Update existing chat
      const { error: updateError } = await supabase
        .from('chats')
        .update({
          title: description,
          url_id: urlId,
          metadata,
        })
        .eq('id', chatId)
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error updating chat:', updateError);
        throw new Error(`Failed to update chat: ${updateError.message}`);
      }
    }

    // Save messages using atomic replacement (like IndexedDB put())
    // Delete all existing messages and insert fresh ones to avoid streaming artifacts
    if (messages.length > 0) {
      console.log('💾 [SAVE] Starting atomic message replacement...');

      // First, delete all existing messages for this chat
      const deleteStart = Date.now();
      const { error: deleteError } = await supabase
        .from('messages')
        .delete()
        .eq('chat_id', chatId);

      console.log(`💾 [SAVE] DELETE completed in ${Date.now() - deleteStart}ms`);

      if (deleteError) {
        console.error('❌ [SAVE] Error deleting old messages:', deleteError);
        throw new Error(`Failed to delete old messages: ${deleteError.message}`);
      }

      // Now insert all messages fresh with sequential numbering
      const messagesToInsert = messages
        .filter(msg => msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system')
        .map((msg, index) => {
          try {
            const messageId = msg.id || generateUUID();

            return {
              id: messageId,
              chat_id: chatId,
              role: msg.role,
              content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
              sequence: index + 1, // Sequential numbering starting from 1
              annotations: msg.annotations ? JSON.stringify(msg.annotations) : null,
            };
          } catch (e) {
            console.error('❌ [SAVE] Error serializing message content:', e, msg);
            return null;
          }
        })
        .filter(Boolean);

      if (messagesToInsert.length === 0) {
        console.log('⚠️ [SAVE] No valid messages to save');
        return;
      }

      console.log(`💾 [SAVE] Inserting ${messagesToInsert.length} messages:`, {
        ids: messagesToInsert.map(m => m?.id),
        sequences: messagesToInsert.map(m => m?.sequence),
        hasAnnotations: messagesToInsert.map(m => !!m?.annotations),
      });

      const insertStart = Date.now();
      const { error: insertError } = await supabase
        .from('messages')
        .insert(messagesToInsert);

      console.log(`💾 [SAVE] INSERT completed in ${Date.now() - insertStart}ms`);

      if (insertError) {
        // Handle duplicate key error gracefully (happens with concurrent saves)
        if (insertError.code === '23505') {
          console.log('⚠️ [SAVE] Duplicate key detected - another save in progress or completed, skipping...');
          return; // Ignore duplicate key errors - another save will handle it
        }
        console.error('❌ [SAVE] Error inserting messages:', insertError);
        throw new Error(`Failed to insert messages: ${insertError.message}`);
      }

      console.log('✅ [SAVE] Successfully saved chat with', messagesToInsert.length, 'messages');
    }
}

export async function deleteChat(chatId: string): Promise<void> {

  const user = await getVerifiedUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from('chats')
    .delete()
    .eq('id', chatId)
    .eq('user_id', user.id);

  if (error) {
    throw new Error(`Failed to delete chat: ${error.message}`);
  }
}

export async function updateChatDescription(chatId: string, description: string): Promise<void> {

  const user = await getVerifiedUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from('chats')
    .update({ title: description })
    .eq('id', chatId)
    .eq('user_id', user.id);

  if (error) {
    throw new Error(`Failed to update chat description: ${error.message}`);
  }
}

export async function createChatFromMessages(
  description: string,
  messages: Message[],
  metadata?: any,
): Promise<string> {

  const user = await getVerifiedUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const newChatId = generateUUID();
  const urlId = `chat-${Date.now()}`;

  await saveChat(newChatId, messages, urlId, description, metadata);

  return urlId;
}

export async function forkChat(chatId: string, messageId: string): Promise<string> {

  const chat = await getChatById(chatId);
  if (!chat) {
    throw new Error('Chat not found');
  }

  // Find the index of the message to fork at
  const messageIndex = chat.messages.findIndex((msg) => msg.id === messageId);
  if (messageIndex === -1) {
    throw new Error('Message not found');
  }

  // Get messages up to and including the selected message
  const messages = chat.messages.slice(0, messageIndex + 1);

  return createChatFromMessages(`${chat.description || 'Chat'} (fork)`, messages);
}

export async function duplicateChat(chatId: string): Promise<string> {

  const chat = await getChatById(chatId);
  if (!chat) {
    throw new Error('Chat not found');
  }

  return createChatFromMessages(`${chat.description || 'Chat'} (copy)`, chat.messages);
}

export async function getNextUrlId(baseUrlId: string): Promise<string> {

  const user = await getVerifiedUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data: existingChats, error } = await supabase
    .from('chats')
    .select('url_id')
    .eq('user_id', user.id)
    .ilike('url_id', `${baseUrlId}%`);

  if (error) {
    throw new Error(`Failed to check URL IDs: ${error.message}`);
  }

  const existingUrls = existingChats.map(chat => chat.url_id).filter(Boolean);

  if (!existingUrls.includes(baseUrlId)) {
    return baseUrlId;
  }

  let counter = 1;
  while (existingUrls.includes(`${baseUrlId}-${counter}`)) {
    counter++;
  }

  return `${baseUrlId}-${counter}`;
}

export async function saveSnapshot(chatId: string, messageId: string, files: any, summary?: string): Promise<void> {

  const user = await getVerifiedUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Get the chat to ensure we have the correct UUID
  const chat = await getChatById(chatId);
  if (!chat) {
    throw new Error('Chat not found or access denied');
  }

  const { error } = await supabase
    .from('snapshots')
    .insert({
      chat_id: chat.id,
      message_id: messageId,
      files_json: files,
      summary,
    });

  if (error) {
    throw new Error(`Failed to save snapshot: ${error.message}`);
  }
}

export async function getSnapshot(chatId: string): Promise<any> {

  const user = await getVerifiedUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Get the chat to ensure we have the correct UUID
  const chat = await getChatById(chatId);
  if (!chat) {
    throw new Error('Chat not found or access denied');
  }

  const { data, error } = await supabase
    .from('snapshots')
    .select('*')
    .eq('chat_id', chat.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') { // Not found error
    throw new Error(`Failed to get snapshot: ${error.message}`);
  }

  return data ? {
    chatIndex: data.message_id,
    files: data.files_json || {},
    summary: data.summary,
  } : null;
}

export type Version = {
  id: string;
  versionNumber: number;
  timestamp: string;
  messageId: string;
  summary?: string;
};

export async function getVersions(chatId: string): Promise<Version[]> {
  const user = await getVerifiedUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Get the chat to ensure we have the correct UUID
  const chat = await getChatById(chatId);
  if (!chat) {
    throw new Error('Chat not found or access denied');
  }

  const { data, error } = await supabase
    .from('snapshots')
    .select('id, message_id, created_at, summary')
    .eq('chat_id', chat.id)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    throw new Error(`Failed to get versions: ${error.message}`);
  }

  // Map to Version type with reversed numbering (latest = highest number)
  return (data || []).map((snapshot, index) => ({
    id: snapshot.id,
    versionNumber: data.length - index,
    timestamp: snapshot.created_at,
    messageId: snapshot.message_id,
    summary: snapshot.summary,
  }));
}

export async function getVersionById(snapshotId: string): Promise<any> {
  const user = await getVerifiedUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('snapshots')
    .select('*')
    .eq('id', snapshotId)
    .single();

  if (error) {
    throw new Error(`Failed to get version: ${error.message}`);
  }

  return data ? {
    id: data.id,
    chatIndex: data.message_id,
    files: data.files_json || {},
    summary: data.summary,
  } : null;
}

// ==================== FINAL VERSION OPERATIONS ====================

export type FinalVersionData = {
  id: string;
  userId: string;
  snapshotId: string;
  chatId: string;
  selectedAt: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FinalVersionWithDetails = FinalVersionData & {
  userName: string;
  userEmail: string;
  chatTitle: string;
  versionNumber: number;
  files: any;
  summary: string | null;
};

/**
 * Set or update user's global final version
 * Since UNIQUE constraint on user_id, this will either INSERT or replace via upsert
 */
export async function setFinalVersion(
  snapshotId: string,
  chatId: string,
  notes?: string
): Promise<void> {
  const user = await getVerifiedUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Verify the snapshot exists and belongs to a chat the user owns
  const { data: snapshot, error: snapshotError } = await supabase
    .from('snapshots')
    .select('chat_id')
    .eq('id', snapshotId)
    .single();

  if (snapshotError || !snapshot) {
    throw new Error('Snapshot not found');
  }

  // Verify the chat belongs to the user
  const { data: chat, error: chatError } = await supabase
    .from('chats')
    .select('id')
    .eq('id', chatId)
    .eq('user_id', user.id)
    .single();

  if (chatError || !chat) {
    throw new Error('Chat not found or access denied');
  }

  // Upsert final version (will replace if user already has one)
  const { error } = await supabase
    .from('final_versions')
    .upsert({
      user_id: user.id,
      snapshot_id: snapshotId,
      chat_id: chatId,
      notes: notes || null,
      selected_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id', // Replace existing final version for this user
    });

  if (error) {
    console.error('Error setting final version:', error);
    throw new Error(`Failed to set final version: ${error.message}`);
  }

  console.log('✅ [FINAL VERSION] Set final version:', { snapshotId, chatId });
}

/**
 * Get the current user's final version
 */
export async function getCurrentUserFinalVersion(): Promise<FinalVersionData | null> {
  const user = await getVerifiedUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('final_versions')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') { // Not found error
    throw new Error(`Failed to get final version: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    userId: data.user_id,
    snapshotId: data.snapshot_id,
    chatId: data.chat_id,
    selectedAt: data.selected_at,
    notes: data.notes,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/**
 * Remove user's final version selection
 */
export async function unsetFinalVersion(): Promise<void> {
  const user = await getVerifiedUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from('final_versions')
    .delete()
    .eq('user_id', user.id);

  if (error) {
    throw new Error(`Failed to unset final version: ${error.message}`);
  }

  console.log('✅ [FINAL VERSION] Unset final version for user:', user.id);
}

/**
 * Get all users' final versions with full details (for the merge page)
 */
export async function getAllFinalVersions(): Promise<FinalVersionWithDetails[]> {
  const user = await getVerifiedUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Query final_versions_with_users view to get real user information
  const { data: finalVersions, error } = await supabase
    .from('final_versions_with_users')
    .select(`
      *,
      snapshots (
        id,
        files_json,
        summary,
        created_at
      ),
      chats (
        title
      )
    `)
    .order('selected_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to get all final versions: ${error.message}`);
  }

  if (!finalVersions || finalVersions.length === 0) {
    return [];
  }

  console.log('📊 [SUPABASE] Raw final versions data:', JSON.stringify(finalVersions, null, 2));

  const result: FinalVersionWithDetails[] = finalVersions.map((fv: any, index: number) => {
    const snapshot = fv.snapshots;
    const chat = fv.chats;

    // Extract username from full_name or email
    const userEmail = fv.user_email || 'user@example.com';
    const userName = fv.user_name || userEmail.split('@')[0] || fv.user_id.substring(0, 8);

    console.log(`📦 [SUPABASE] Processing final version ${index + 1}:`, {
      id: fv.id,
      snapshot_id: fv.snapshot_id,
      userEmail,
      userName,
      hasSnapshot: !!snapshot,
      snapshotType: typeof snapshot,
      snapshotValue: snapshot,
      hasFilesJson: !!snapshot?.files_json,
      filesJsonType: typeof snapshot?.files_json,
      filesJsonKeys: snapshot?.files_json ? Object.keys(snapshot.files_json).length : 0,
    });

    return {
      id: fv.id,
      userId: fv.user_id,
      snapshotId: fv.snapshot_id,
      chatId: fv.chat_id,
      selectedAt: fv.selected_at,
      notes: fv.notes,
      createdAt: fv.created_at,
      updatedAt: fv.updated_at,
      userName,
      userEmail,
      chatTitle: chat?.title || 'Untitled Chat',
      versionNumber: 1, // Would need to calculate based on snapshot order
      files: snapshot?.files_json || {},
      summary: snapshot?.summary || null,
    };
  });

  console.log('✅ [SUPABASE] Mapped final versions with files:', result.map(r => ({
    id: r.id,
    userName: r.userName,
    userEmail: r.userEmail,
    hasFiles: !!r.files,
    fileCount: Object.keys(r.files || {}).length,
  })));

  return result;
}

/**
 * Get detailed information about a specific final version
 */
export async function getFinalVersionDetails(finalVersionId: string): Promise<FinalVersionWithDetails | null> {
  const user = await getVerifiedUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('final_versions_with_users')
    .select(`
      *,
      snapshots (
        id,
        files_json,
        summary,
        created_at
      ),
      chats (
        title
      )
    `)
    .eq('id', finalVersionId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to get final version details: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const snapshot = (data as any).snapshots;
  const chat = (data as any).chats;

  // Extract username from full_name or email
  const userEmail = (data as any).user_email || 'user@example.com';
  const userName = (data as any).user_name || userEmail.split('@')[0] || data.user_id.substring(0, 8);

  return {
    id: data.id,
    userId: data.user_id,
    snapshotId: data.snapshot_id,
    chatId: data.chat_id,
    selectedAt: data.selected_at,
    notes: data.notes,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    userName,
    userEmail,
    chatTitle: chat?.title || 'Untitled Chat',
    versionNumber: 1,
    files: snapshot?.files_json || {},
    summary: snapshot?.summary || null,
  };
}

/**
 * Check if a specific snapshot is marked as user's final version
 */
export async function isSnapshotFinalVersion(snapshotId: string): Promise<boolean> {
  const user = await getVerifiedUser();
  if (!user) {
    return false;
  }

  const { data, error } = await supabase
    .from('final_versions')
    .select('id')
    .eq('user_id', user.id)
    .eq('snapshot_id', snapshotId)
    .single();

  return !error && !!data;
}

// =============================================
// FINAL VERSION VOTING FUNCTIONS
// =============================================

/**
 * Vote on a final version
 */
export async function voteFinalVersion(
  finalVersionId: string,
  roomId: string,
  vote: 'like' | 'dislike',
  commentText?: string
): Promise<void> {
  const user = await getVerifiedUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { error } = await supabase
    .from('final_version_votes')
    .upsert(
      {
        final_version_id: finalVersionId,
        room_id: roomId,
        user_id: user.id,
        vote,
        comment_text: commentText || null,
      },
      {
        onConflict: 'final_version_id,room_id,user_id',
      }
    );

  if (error) {
    throw new Error(`Failed to vote: ${error.message}`);
  }
}

/**
 * Get all votes for a room, aggregated by final version
 */
export async function getFinalVersionVotesForRoom(
  roomId: string
): Promise<Record<string, any>> {
  const user = await getVerifiedUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data: votes, error } = await supabase
    .from('final_version_votes')
    .select('*')
    .eq('room_id', roomId);

  if (error) {
    throw new Error(`Failed to fetch votes: ${error.message}`);
  }

  // Aggregate votes by final_version_id
  const votesByVersion: Record<string, any> = {};

  votes?.forEach((vote) => {
    const versionId = vote.final_version_id;

    if (!votesByVersion[versionId]) {
      votesByVersion[versionId] = {
        like: 0,
        dislike: 0,
      };
    }

    // Count votes
    if (vote.vote === 'like') {
      votesByVersion[versionId].like++;
    } else if (vote.vote === 'dislike') {
      votesByVersion[versionId].dislike++;
    }

    // Track current user's vote
    if (vote.user_id === user.id) {
      votesByVersion[versionId].userVote = {
        vote: vote.vote,
        comment: vote.comment_text,
        createdAt: vote.created_at,
      };
    }
  });

  return votesByVersion;
}

/**
 * Get vote counts for a specific final version in a room
 */
export async function getFinalVersionVoteCounts(
  finalVersionId: string,
  roomId: string
): Promise<{ like: number; dislike: number }> {
  const user = await getVerifiedUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data: votes, error } = await supabase
    .from('final_version_votes')
    .select('vote')
    .eq('final_version_id', finalVersionId)
    .eq('room_id', roomId);

  if (error) {
    throw new Error(`Failed to fetch vote counts: ${error.message}`);
  }

  return {
    like: votes?.filter((v) => v.vote === 'like').length || 0,
    dislike: votes?.filter((v) => v.vote === 'dislike').length || 0,
  };
}

// ==================== Meeting Chat Messages ====================

/**
 * Save a chat message (text or image) to the database
 */
export async function saveChatMessage(
  roomId: string,
  messageType: 'text' | 'image',
  content: string,
  senderUsername: string,
  imagePrompt?: string
) {
  const user = await getVerifiedUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('meeting_chat_messages')
    .insert({
      room_id: roomId,
      message_type: messageType,
      sender_user_id: user.id,
      sender_username: senderUsername,
      content,
      image_prompt: imagePrompt || null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save chat message: ${error.message}`);
  }

  return data;
}

/**
 * Get all chat messages for a room
 */
export async function getChatMessages(roomId: string) {
  const user = await getVerifiedUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('meeting_chat_messages')
    .select('*')
    .eq('room_id', roomId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch chat messages: ${error.message}`);
  }

  return data || [];
}

/**
 * Subscribe to real-time chat messages for a room
 */
export function subscribeToChatMessages(
  roomId: string,
  callback: (message: any) => void
) {
  const subscription = supabase
    .channel(`meeting_chat:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'meeting_chat_messages',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        callback(payload.new);
      }
    )
    .subscribe();

  return subscription;
}

// ==================== Room Design Generation ====================

/**
 * Get or create prompt template for a room
 * If template doesn't exist, creates one with default values
 */
export async function getOrCreatePromptTemplate(roomId: string) {
  const user = await getVerifiedUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  // Try to get existing template
  const { data: existing, error: fetchError } = await supabase
    .from('prompt_templates')
    .select('*')
    .eq('room_id', roomId)
    .single();

  if (existing && !fetchError) {
    return existing;
  }

  // Create default template if not found
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
    throw new Error(`Failed to create prompt template: ${createError.message}`);
  }

  return created;
}

/**
 * Update prompt template for a room
 */
export async function updatePromptTemplate(
  roomId: string,
  updates: {
    template?: string;
    tech_stack?: string;
    design_preference?: string;
    complexity_level?: string;
  }
) {
  const user = await getVerifiedUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('prompt_templates')
    .update({
      ...updates,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('room_id', roomId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update prompt template: ${error.message}`);
  }

  return data;
}

/**
 * Get all room design chats for a room (generation history)
 */
export async function getRoomDesignChats(roomId: string) {
  const user = await getVerifiedUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('room_design_chats')
    .select('*')
    .eq('room_id', roomId)
    .order('generated_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch room design chats: ${error.message}`);
  }

  return data || [];
}

/**
 * Get the latest room design chat for a room
 */
export async function getLatestRoomDesignChat(roomId: string) {
  const user = await getVerifiedUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('room_design_chats')
    .select('*')
    .eq('room_id', roomId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    throw new Error(`Failed to fetch latest room design chat: ${error.message}`);
  }

  return data || null;
}

/**
 * Create a new room design chat record
 */
export async function createRoomDesignChat(
  roomId: string,
  chatId: string,
  promptUsed: string,
  metadata?: any
) {
  const user = await getVerifiedUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('room_design_chats')
    .insert({
      room_id: roomId,
      chat_id: chatId,
      generated_by: user.id,
      prompt_used: promptUsed,
      metadata: metadata || {},
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create room design chat: ${error.message}`);
  }

  return data;
}

/**
 * Check if user has already forked a specific room design
 */
export async function getUserForkOfDesign(sourceChat: string) {
  const user = await getVerifiedUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('user_id', user.id)
    .filter('metadata->>forked_from', 'eq', sourceChat)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Failed to check for fork: ${error.message}`);
  }

  return data || null;
}

/**
 * Fork a room design chat for the current user
 * Creates a copy of all messages and files for independent editing
 */
export async function forkRoomDesignChat(
  sourceChatId: string,
  roomId: string
) {
  const user = await getVerifiedUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  console.log('🍴 [FORK] Starting fork of room design:', { sourceChatId, roomId, userId: user.id });

  // Check if user already has a fork
  const existingFork = await getUserForkOfDesign(sourceChatId);
  if (existingFork) {
    console.log('🍴 [FORK] Fork already exists:', existingFork.id);
    return existingFork;
  }

  // Get source chat details using secure function (bypasses RLS)
  // This is necessary because the master chat belongs to the admin user
  console.log('🍴 [FORK] Fetching source chat via RPC:', sourceChatId);
  const { data: sourceChatRPC, error: sourceChatError } = await supabase
    .rpc('get_room_design_master_chat', { p_chat_id: sourceChatId });

  console.log('🍴 [FORK] Source chat RPC result:', {
    found: !!sourceChatRPC,
    count: sourceChatRPC?.length || 0,
    error: sourceChatError?.message,
  });

  if (sourceChatError) {
    throw new Error(`Failed to fetch source chat: ${sourceChatError.message}`);
  }

  if (!sourceChatRPC || sourceChatRPC.length === 0) {
    throw new Error(`Source chat not found or not a room design: ${sourceChatId}`);
  }

  const sourceChatData = sourceChatRPC[0];

  // Get source messages using secure function (bypasses RLS)
  console.log('🍴 [FORK] Fetching source messages via RPC');
  const { data: sourceMessages, error: messagesError } = await supabase
    .rpc('get_room_design_master_messages', { p_chat_id: sourceChatId });

  if (messagesError) {
    throw new Error(`Failed to fetch source messages: ${messagesError.message}`);
  }

  console.log('🍴 [FORK] Source data loaded:', {
    messageCount: sourceMessages?.length || 0,
    sourceTitle: sourceChatData.title,
  });

  // Create new chat for this user
  const newChatId = generateUUID();
  const newUrlId = generateId();
  const forkedTitle = `${sourceChatData.title || 'Room Design'} (My Copy)`;

  const { error: chatCreateError } = await supabase
    .from('chats')
    .insert({
      id: newChatId,
      user_id: user.id,
      title: forkedTitle,
      url_id: newUrlId,
      metadata: {
        type: 'forked_design',
        forked_from: sourceChatId,
        room_id: roomId,
        forked_at: new Date().toISOString(),
        auto_submit_first: false, // Never auto-submit forked designs - they already have AI-generated code
      },
    });

  if (chatCreateError) {
    throw new Error(`Failed to create forked chat: ${chatCreateError.message}`);
  }

  console.log('🍴 [FORK] New chat created:', { newChatId, newUrlId });

  // Copy all messages
  if (sourceMessages && sourceMessages.length > 0) {
    const newMessages = sourceMessages.map((msg, index) => ({
      id: generateUUID(),
      chat_id: newChatId,
      role: msg.role,
      content: msg.content,
      sequence: index + 1,
      annotations: msg.annotations,
    }));

    const { error: messagesInsertError } = await supabase
      .from('messages')
      .insert(newMessages);

    if (messagesInsertError) {
      // Rollback: delete the created chat
      await supabase.from('chats').delete().eq('id', newChatId);
      throw new Error(`Failed to copy messages: ${messagesInsertError.message}`);
    }

    console.log('🍴 [FORK] Messages copied:', newMessages.length);
  }

  // Get the latest snapshot from source chat to copy files
  const { data: sourceSnapshot, error: snapshotError } = await supabase
    .from('snapshots')
    .select('*')
    .eq('chat_id', sourceChatId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!snapshotError && sourceSnapshot) {
    // Create snapshot for the forked chat
    const { error: snapshotCreateError } = await supabase
      .from('snapshots')
      .insert({
        chat_id: newChatId,
        message_id: sourceSnapshot.message_id,
        files_json: sourceSnapshot.files_json,
        summary: `Forked from room design`,
      });

    if (snapshotCreateError) {
      console.warn('⚠️ [FORK] Failed to copy snapshot:', snapshotCreateError.message);
      // Don't fail the entire fork, just log the warning
    } else {
      console.log('🍴 [FORK] Snapshot copied');
    }
  }

  // Return the new chat
  const { data: newChat, error: fetchNewChatError } = await supabase
    .from('chats')
    .select('*')
    .eq('id', newChatId)
    .single();

  if (fetchNewChatError) {
    throw new Error(`Failed to fetch new chat: ${fetchNewChatError.message}`);
  }

  console.log('✅ [FORK] Fork completed successfully');
  return newChat;
}

/**
 * Adopt a design from a final version
 * Creates a new chat with the files from another user's submitted design
 * Allows users to continue working on an existing design
 */
export async function adoptFinalVersionDesign(
  finalVersion: FinalVersionWithDetails,
  roomId: string
): Promise<{ id: string; url_id: string }> {
  const user = await getVerifiedUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  console.log('🔄 [ADOPT] Starting design adoption:', {
    finalVersionId: finalVersion.id,
    originalUser: finalVersion.userName,
    roomId,
    userId: user.id,
  });

  // Generate new IDs
  const newChatId = generateUUID();
  const newUrlId = generateUUID().split('-')[0];

  // Create the new chat
  const { error: chatCreateError } = await supabase
    .from('chats')
    .insert({
      id: newChatId,
      user_id: user.id,
      title: `Adopted from ${finalVersion.userName}'s design: ${finalVersion.chatTitle || 'Untitled'}`,
      url_id: newUrlId,
      metadata: {
        type: 'adopted_design',
        adopted_from_version: finalVersion.id,
        adopted_from_user: finalVersion.userName,
        room_id: roomId,
        adopted_at: new Date().toISOString(),
        auto_submit_first: false,
      },
    });

  if (chatCreateError) {
    throw new Error(`Failed to create adopted chat: ${chatCreateError.message}`);
  }

  console.log('🔄 [ADOPT] New chat created:', { newChatId, newUrlId });

  // Create initial message to document the adoption
  const adoptionMessage = {
    id: generateUUID(),
    chat_id: newChatId,
    role: 'assistant',
    content: `This design was adopted from **${finalVersion.userName}**'s submission.\n\nOriginal title: ${finalVersion.chatTitle || 'Untitled'}\n${finalVersion.notes ? `\nNotes: ${finalVersion.notes}` : ''}\n\nYou can continue editing and improving this design.`,
    sequence: 1,
    annotations: null,
  };

  const { error: messageError } = await supabase
    .from('messages')
    .insert(adoptionMessage);

  if (messageError) {
    console.warn('⚠️ [ADOPT] Failed to create adoption message:', messageError.message);
  }

  // Create snapshot with the files from the final version
  if (finalVersion.files && Object.keys(finalVersion.files).length > 0) {
    const { error: snapshotError } = await supabase
      .from('snapshots')
      .insert({
        chat_id: newChatId,
        message_id: adoptionMessage.id,
        files_json: finalVersion.files,
        summary: `Adopted from ${finalVersion.userName}'s design`,
      });

    if (snapshotError) {
      console.warn('⚠️ [ADOPT] Failed to create snapshot:', snapshotError.message);
    } else {
      console.log('🔄 [ADOPT] Snapshot created with files');
    }
  }

  // Register as a room design chat so it shows in the design page
  const { error: roomDesignError } = await supabase
    .from('room_design_chats')
    .insert({
      room_id: roomId,
      chat_id: newChatId,
      user_id: user.id,
      is_master: false,
      forked_from: finalVersion.chatId || null,
    });

  if (roomDesignError) {
    console.warn('⚠️ [ADOPT] Failed to register room design chat:', roomDesignError.message);
  }

  console.log('✅ [ADOPT] Design adoption completed successfully');
  return { id: newChatId, url_id: newUrlId };
}

/**
 * Subscribe to new room design chats for real-time updates
 */
export function subscribeToRoomDesignChats(
  roomId: string,
  callback: (design: any) => void
) {
  const subscription = supabase
    .channel(`room-design:${roomId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'room_design_chats',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        callback(payload.new);
      }
    )
    .subscribe();

  return subscription;
}
