/**
 * Utility for managing global meeting user identity
 *
 * This module provides a persistent user identity for meeting participants
 * that works across all meeting rooms and browser sessions.
 */

const STORAGE_KEY_USERNAME = 'bolt-meeting-username';
const STORAGE_KEY_UUID = 'bolt-meeting-user-uuid';

/**
 * Gets or generates a global meeting username for the current browser
 *
 * The username is:
 * - Generated once per browser/device
 * - Persists across all meeting rooms
 * - Stored in localStorage for persistence
 * - Format: user-{timestamp}-{random}
 *
 * @returns {string} The global meeting username
 *
 * @example
 * ```tsx
 * const username = getGlobalMeetingUsername();
 * // Returns: "user-abc123xyz-def456"
 * // Same value on subsequent calls
 * ```
 */
export function getGlobalMeetingUsername(): string {
  // IMPORTANT: This must only be called on the client side
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    console.error('❌ [MEETING_USER] Cannot generate username - not in browser environment');
    // Return empty string to signal that it's not ready
    // Caller should handle this case
    return '';
  }

  try {
    // Check if username already exists in localStorage
    let username = localStorage.getItem(STORAGE_KEY_USERNAME);

    if (!username || username.trim() === '') {
      // Generate unique username
      // Format: user-{base36-timestamp}-{random}
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 8);
      username = `user-${timestamp}-${random}`;

      // Store for future use
      localStorage.setItem(STORAGE_KEY_USERNAME, username);

      console.log('🆔 [MEETING_USER] Generated new global username:', username);
    } else {
      console.log('🆔 [MEETING_USER] Retrieved existing username:', username);
    }

    // Validate username format
    if (!username || username.trim() === '') {
      console.error('❌ [MEETING_USER] Generated username is empty!');
      return '';
    }

    return username;
  } catch (error) {
    console.error('❌ [MEETING_USER] Error accessing localStorage:', error);
    return '';
  }
}

/**
 * Gets or generates a global meeting user UUID for the current browser
 *
 * The UUID is:
 * - Generated once per browser/device (same as username)
 * - Persists across all meeting rooms
 * - Stored in localStorage for persistence
 * - Valid UUID format for database compatibility
 *
 * @returns {string} The global meeting user UUID
 *
 * @example
 * ```tsx
 * const uuid = getGlobalMeetingUserUUID();
 * // Returns: "a1b2c3d4-e5f6-4789-0abc-def123456789"
 * // Same value on subsequent calls
 * ```
 */
export function getGlobalMeetingUserUUID(): string {
  // IMPORTANT: This must only be called on the client side
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    console.error('❌ [MEETING_USER] Cannot generate UUID - not in browser environment');
    return '';
  }

  try {
    // Check if UUID already exists in localStorage
    let uuid = localStorage.getItem(STORAGE_KEY_UUID);

    if (!uuid || uuid.trim() === '') {
      // Generate a valid UUID
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        uuid = crypto.randomUUID();
      } else {
        // Fallback for older browsers
        uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      }

      // Store for future use
      localStorage.setItem(STORAGE_KEY_UUID, uuid);

      console.log('🆔 [MEETING_USER] Generated new global UUID:', uuid);
    } else {
      console.log('🆔 [MEETING_USER] Retrieved existing UUID:', uuid);
    }

    // Validate UUID format
    if (!uuid || uuid.trim() === '') {
      console.error('❌ [MEETING_USER] Generated UUID is empty!');
      return '';
    }

    return uuid;
  } catch (error) {
    console.error('❌ [MEETING_USER] Error accessing localStorage:', error);
    return '';
  }
}

/**
 * Gets both username and UUID together
 * Ensures they are generated as a pair
 *
 * @returns {{ username: string; uuid: string }} The global meeting user identity
 */
export function getGlobalMeetingUser(): { username: string; uuid: string } {
  const username = getGlobalMeetingUsername();
  const uuid = getGlobalMeetingUserUUID();

  return { username, uuid };
}

/**
 * Clears the stored meeting username and UUID
 * Useful for testing or allowing user to reset their identity
 */
export function clearMeetingUsername(): void {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY_USERNAME);
    localStorage.removeItem(STORAGE_KEY_UUID);
    console.log('🆔 [MEETING_USER] Cleared meeting username and UUID');
  }
}

/**
 * Checks if a meeting username exists
 * @returns {boolean} True if a username is stored
 */
export function hasMeetingUsername(): boolean {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false;
  }

  return localStorage.getItem(STORAGE_KEY_USERNAME) !== null;
}

// Note: initializeMeetingAuth() function removed as anonymous authentication is no longer used.
// All meeting rooms now require regular email/password authentication.
// The username/UUID generation functions above are kept for potential future use.
