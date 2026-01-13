import { openDatabase, getAll } from '~/lib/persistence/db';
import { saveChat, createChatFromMessages } from '~/lib/persistence/supabase';
import { getCurrentUser } from '~/lib/supabase/auth';
import { toast } from 'react-toastify';

export async function migrateFromIndexedDB() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      toast.error('You must be signed in to migrate data');
      return;
    }

    const db = await openDatabase();
    if (!db) {
      toast.error('IndexedDB not available');
      return;
    }

    const chats = await getAll(db);

    if (chats.length === 0) {
      toast.info('No chats found to migrate');
      return;
    }

    let migratedCount = 0;

    for (const chat of chats) {
      try {
        // Check if chat already exists in Supabase by URL ID
        if (chat.urlId) {
          // Skip if already migrated (you could add a check here)
        }

        // Create chat in Supabase
        await createChatFromMessages(
          chat.description || 'Migrated Chat',
          chat.messages,
          chat.metadata
        );

        migratedCount++;
      } catch (error) {
        console.error(`Failed to migrate chat ${chat.id}:`, error);
      }
    }

    if (migratedCount > 0) {
      toast.success(`Successfully migrated ${migratedCount} chats to Supabase!`);
    }

    // Close IndexedDB
    db.close();

  } catch (error: any) {
    console.error('Migration failed:', error);
    toast.error('Migration failed: ' + error.message);
  }
}
