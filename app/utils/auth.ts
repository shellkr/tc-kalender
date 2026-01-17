// utils/auth.ts – Authentication and session management utilities
// Smart reload: Check if calendar content changed before reloading

import { Context } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { randomBytes } from 'crypto';
import {
  loadSession,
  saveSession,
  deleteSession,
  loadUserSettings,
  saveUserSettings
} from './storage';
import {
  hashUsername,
  encrypt,
  decrypt,
  defaultSettings,
  fetchSwedishHolidays,
  parseICS
} from './helpers';

// In-memory session storage (file-based persistence on disk)
const activeSessions = new Map<string, any>();

/**
 * Generate a secure random session ID
 */
export function generateSessionId(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Get current session from cookie
 * Checks if calendar content changed and reloads only if needed
 */
export async function getSession(c: Context): Promise<any | null> {
  const sessionId = getCookie(c, 'session_id');
  if (!sessionId) {
    return null;
  }

  let session = activeSessions.get(sessionId);

  // If session not in memory, load from disk and check for changes
  if (!session) {
    session = await loadSession(sessionId);
    if (session) {
      activeSessions.set(sessionId, session);
      
      // Check if calendar content changed
      if (session.settings?.calendarUrls?.length > 0) {
        try {
          const hasChanges = await checkCalendarChanges(
            session.settings.calendarUrls,
            session.calendarHashes || {}
          );
          
          if (hasChanges) {
            const freshEvents = await reloadCalendarEvents(
              session.settings.calendarUrls, 
              session.hiddenEvents || []
            );
            session.events = freshEvents;
            session.lastEventReload = Date.now();
            
            // Update session in memory and disk
            activeSessions.set(sessionId, session);
            await saveSession(sessionId, session);
            
            console.log(`✓ Reloaded ${freshEvents.length} events from ${session.settings.calendarUrls.length} calendar(s)`);
          } else {
            console.log(`✓ Using cached events (${session.events?.length || 0} events, no changes detected)`);
          }
        } catch (error) {
          console.error(`✗ Failed to check calendars: ${error.message}`);
        }
      }
    }
  }

  if (!session) {
    return null;
  }

  if (session) {
    session.sessionId = sessionId;
  }

  return session ?? null;
}

/**
 * Check if calendar content has changed by comparing content hashes
 * Returns true if any calendar has changed
 */
async function checkCalendarChanges(
  calendarUrls: any[], 
  cachedHashes: Record<string, string>
): Promise<boolean> {
  for (const calendar of calendarUrls) {
    try {
      const content = await fetchICS(calendar.url, calendar.name);
      const contentHash = simpleHash(content);
      
      if (cachedHashes[calendar.id] !== contentHash) {
        return true; // Content changed
      }
    } catch (error) {
      // If we can't fetch, assume changed (will reload)
      return true;
    }
  }
  
  return false; // No changes detected
}

/**
 * Simple hash function for content comparison
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Reload all events from calendar URLs
 * Filters out hidden events and stores content hashes
 */
async function reloadCalendarEvents(calendarUrls: any[], hiddenEvents: string[] = []): Promise<any[]> {
  const allEvents: any[] = [];
  const errors: string[] = [];

  for (const calendar of calendarUrls) {
    try {
      const icsContent = await fetchICS(calendar.url, calendar.name);
      const result = parseICS(icsContent, calendar.id);

      result.events.forEach((e: any) => {
        const eventKey = `${calendar.id}_${e.summary}_${e.start.toISOString()}`;
        
        // Skip hidden events
        if (hiddenEvents.includes(eventKey)) {
          return;
        }

        allEvents.push({
          ...e,
          calendarId: calendar.id,
          start: e.start.toISOString(),
          end: e.end.toISOString(),
          id: e.id ?? Math.random().toString(36).substr(2, 9)
        });
      });
    } catch (error) {
      errors.push(`${calendar.name}: ${error.message}`);
    }
  }

  // Report errors if any
  if (errors.length > 0) {
    console.error(`✗ Calendar errors:\n  - ${errors.join('\n  - ')}`);
  }

  return allEvents;
}

/**
 * Store calendar content hashes in session for change detection
 */
async function updateCalendarHashes(session: any): Promise<void> {
  if (!session.settings?.calendarUrls?.length) {
    return;
  }

  const hashes: Record<string, string> = {};
  
  for (const calendar of session.settings.calendarUrls) {
    try {
      const content = await fetchICS(calendar.url, calendar.name);
      hashes[calendar.id] = simpleHash(content);
    } catch (error) {
      // If we can't fetch, don't update hash
    }
  }
  
  session.calendarHashes = hashes;
}

/**
 * Create new session and set cookie
 */
export function createSession(
  c: Context,
  username: string,
  password: string,
  settings: any,
  sessionData: any
): string {
  const sessionId = generateSessionId();
  const userHash = hashUsername(username);

  const session = {
    sessionId,
    username,
    userHash,
    password,
    settings,
    events: sessionData.events ?? [],
    hiddenEvents: sessionData.hiddenEvents ?? [],
    holidays: sessionData.holidays ?? {},
    calendarHashes: {},
    lastEventReload: Date.now()
  };

  activeSessions.set(sessionId, session);
  saveSession(sessionId, session);

  // Store initial hashes asynchronously
  updateCalendarHashes(session).then(() => {
    saveSession(sessionId, session);
  });

  setCookie(c, 'session_id', sessionId, {
    httpOnly: true,
    secure: false,
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 7
  });

  return sessionId;
}

/**
 * Destroy session and clear cookie
 */
export function destroySession(c: Context): void {
  const sessionId = getCookie(c, 'session_id');

  if (sessionId) {
    activeSessions.delete(sessionId);
    deleteSession(sessionId);
  }

  setCookie(c, 'session_id', '', { maxAge: 0 });
}

/**
 * Authenticate user with username and password
 * Returns settings if successful, throws error otherwise
 * Always fetches fresh events from calendar URLs on login
 */
export async function authenticateUser(
  username: string,
  password: string
): Promise<any> {
  if (!username || !password) {
    throw new Error('Användarnamn och lösenord krävs');
  }

  const userHash = hashUsername(username);
  const existingData = await loadUserSettings(userHash);

  let settings: any;
  let events: any[] = [];
  let hiddenEvents: any[] = [];
  let holidays: any = {};

  if (existingData) {
    try {
      const decryptedData = decrypt(existingData, password);

      hiddenEvents = decryptedData.hiddenEvents ?? [];
      holidays = decryptedData.holidays ?? {};

      settings = { ...decryptedData };
      delete settings.events;
      delete settings.hiddenEvents;
      delete settings.holidays;

      // Fetch fresh events from calendar URLs
      if (Array.isArray(settings.calendarUrls) && settings.calendarUrls.length > 0) {
        events = await reloadCalendarEvents(settings.calendarUrls, hiddenEvents);
        console.log(`✓ Loaded ${events.length} events from ${settings.calendarUrls.length} calendar(s)`);
      }
    } catch {
      throw new Error('Fel lösenord');
    }
  } else {
    settings = defaultSettings;
    const encrypted = encrypt(settings, password);
    await saveUserSettings(userHash, encrypted);
  }

  return { settings, events, hiddenEvents, holidays };
}

/**
 * Fetch ICS content from URL with fallback to CORS proxy
 */
async function fetchICS(url: string, name: string): Promise<string> {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error(`Cannot refetch uploaded file: ${name}`);
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } catch {
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) {
      throw new Error(`Proxy HTTP ${response.status}`);
    }
    return await response.text();
  }
}

/**
 * Load holidays for current and next year
 */
export async function loadHolidays(): Promise<Record<string, string>> {
  const currentYear = new Date().getFullYear();
  const holidays = await fetchSwedishHolidays(currentYear);
  const nextYearHolidays = await fetchSwedishHolidays(currentYear + 1);
  return { ...holidays, ...nextYearHolidays };
}

/**
 * Require authentication middleware
 */
export async function requireAuth(c: Context): Promise<any | null> {
  const session = await getSession(c);
  if (!session) {
    return c.redirect('/login');
  }
  return session;
}

/**
 * Save session data to persistent storage
 * Don't save events - they'll be fetched fresh from calendar URLs
 */
export async function saveSessionData(session: any): Promise<void> {
  if (!session.sessionId) {
    return;
  }

  activeSessions.set(session.sessionId, session);
  await saveSession(sessionId, session);

  if (session.userHash && session.password && session.settings) {
    try {
      const dataToSave = {
        ...session.settings,
        hiddenEvents: session.hiddenEvents ?? [],
        holidays: session.holidays ?? {}
      };

      const encrypted = encrypt(dataToSave, session.password);
      await saveUserSettings(session.userHash, encrypted);
    } catch (error) {
      console.error('Save failed:', error.message);
    }
  }
}

/**
 * Force reload events for current session
 * Used by manual refresh button
 */
export async function forceReloadEvents(session: any): Promise<void> {
  if (!session.settings?.calendarUrls?.length) {
    throw new Error('Inga kalendrar att uppdatera');
  }

  const freshEvents = await reloadCalendarEvents(session.settings.calendarUrls, session.hiddenEvents || []);
  session.events = freshEvents;
  session.lastEventReload = Date.now();
  
  // Update hashes after force reload
  await updateCalendarHashes(session);
  
  activeSessions.set(session.sessionId, session);
  await saveSession(session.sessionId, session);
  
  console.log(`✓ Reloaded ${freshEvents.length} events from ${session.settings.calendarUrls.length} calendar(s)`);
}

/**
 * Get calendar reload status for UI display
 */
export function getReloadStatus(session: any): { lastReload: number | null, minutesSince: number | null } {
  if (!session.lastEventReload) {
    return { lastReload: null, minutesSince: null };
  }

  const now = Date.now();
  const minutesSince = Math.floor((now - session.lastEventReload) / 60000);
  
  return { lastReload: session.lastEventReload, minutesSince };
}
