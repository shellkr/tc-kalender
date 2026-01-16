// utils/auth.ts – Authentication and session management utilities
// FIXED: Always reload calendar URLs on page refresh to get latest events

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
 * FIXED: Always reload events from calendar URLs on session retrieval
 */
export async function getSession(c: Context): Promise<any | null> {
  const sessionId = getCookie(c, 'session_id');
  if (!sessionId) {
    return null;
  }

  let session = activeSessions.get(sessionId);

  if (!session) {
    session = await loadSession(sessionId);
    if (session) {
      activeSessions.set(sessionId, session);
    }
  }

  if (!session) {
    return null;
  }

  // FIXED: Check if we need to reload events from calendar URLs
  // Reload if: 1) No events in session, 2) Calendar URLs exist, 3) More than 5 minutes since last reload
  const now = Date.now();
  const lastReload = session.lastEventReload || 0;
  const fiveMinutes = 5 * 60 * 1000;
  const shouldReload = 
    (!session.events || session.events.length === 0) || 
    (session.settings?.calendarUrls?.length > 0 && (now - lastReload > fiveMinutes));

  if (shouldReload && session.settings?.calendarUrls?.length > 0) {
    console.log(`🔄 Reloading events from ${session.settings.calendarUrls.length} calendar(s)...`);
    
    try {
      const freshEvents = await reloadCalendarEvents(session.settings.calendarUrls, session.hiddenEvents || []);
      session.events = freshEvents;
      session.lastEventReload = now;
      
      // Update both memory and disk
      activeSessions.set(sessionId, session);
      await saveSession(sessionId, session);
      
      console.log(`✅ Reloaded ${freshEvents.length} events`);
    } catch (error) {
      console.error('❌ Failed to reload calendar events:', error);
      // Continue with cached events if reload fails
    }
  }

  if (session) {
    session.sessionId = sessionId;
  }

  return session ?? null;
}

/**
 * Reload all events from calendar URLs
 * Filters out hidden events
 */
async function reloadCalendarEvents(calendarUrls: any[], hiddenEvents: string[] = []): Promise<any[]> {
  const allEvents: any[] = [];

  for (const calendar of calendarUrls) {
    try {
      console.log(`📥 Fetching calendar: ${calendar.name}`);
      
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

      console.log(`✅ Loaded ${result.events.length} events from ${calendar.name}`);
    } catch (error) {
      console.error(`❌ Failed to fetch calendar ${calendar.name}:`, error);
      // Continue with other calendars even if one fails
    }
  }

  return allEvents;
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
    lastEventReload: Date.now() // Track when events were last reloaded
  };

  activeSessions.set(sessionId, session);
  saveSession(sessionId, session);

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
 * FIXED: Always fetch fresh events from calendar URLs on login
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

      // Load stored data
      hiddenEvents = decryptedData.hiddenEvents ?? [];
      holidays = decryptedData.holidays ?? {};

      settings = { ...decryptedData };
      delete settings.events;
      delete settings.hiddenEvents;
      delete settings.holidays;

      // FIXED: Always fetch fresh events from calendar URLs on login
      if (Array.isArray(settings.calendarUrls) && settings.calendarUrls.length > 0) {
        console.log(`🔄 Fetching fresh events from ${settings.calendarUrls.length} calendars on login...`);
        
        events = await reloadCalendarEvents(settings.calendarUrls, hiddenEvents);
        
        console.log(`🎉 Total events loaded: ${events.length}`);
      }
    } catch {
      throw new Error('Fel lösenord');
    }
  } else {
    // New user - create default settings
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
  // Special handling for file names (uploaded ICS files)
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error(`Cannot refetch uploaded file: ${name}. Please re-upload if needed.`);
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Direct fetch failed');
    }

    return await response.text();
  } catch {
    console.log(`⚠️  Direct fetch failed for ${name}, trying CORS proxy...`);

    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);

    if (!response.ok) {
      throw new Error(`Proxy fetch failed for ${name}`);
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
 * Redirects to login if not authenticated
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
 * FIXED: Don't save events array to user settings - only to session
 * Events should be fetched fresh from calendar URLs on each login/reload
 */
export async function saveSessionData(session: any): Promise<void> {
  if (!session.sessionId) {
    console.error('Could not save session data - session ID missing');
    return;
  }

  // Update in-memory session
  activeSessions.set(session.sessionId, session);
  
  // Save full session to disk (includes events for current session)
  await saveSession(session.sessionId, session);

  // Save user settings to persistent storage (without events - they'll be reloaded)
  if (session.userHash && session.password && session.settings) {
    try {
      const dataToSave = {
        ...session.settings,
        // FIXED: Don't save events array - it will be fetched fresh from calendar URLs
        // events: session.events ?? [],
        hiddenEvents: session.hiddenEvents ?? [],
        holidays: session.holidays ?? {}
      };

      const encrypted = encrypt(dataToSave, session.password);
      await saveUserSettings(session.userHash, encrypted);

      console.log(`✅ Saved persistent settings for user: ${session.userHash}`);
    } catch (error) {
      console.error('Failed to save user settings:', error);
    }
  }
}

/**
 * Force reload events for current session
 * Can be called manually when user wants to refresh calendar data
 */
export async function forceReloadEvents(session: any): Promise<void> {
  if (!session.settings?.calendarUrls?.length) {
    console.log('No calendar URLs to reload');
    return;
  }

  console.log(`🔄 Force reloading events from ${session.settings.calendarUrls.length} calendar(s)...`);
  
  try {
    const freshEvents = await reloadCalendarEvents(session.settings.calendarUrls, session.hiddenEvents || []);
    session.events = freshEvents;
    session.lastEventReload = Date.now();
    
    // Update both memory and disk
    activeSessions.set(session.sessionId, session);
    await saveSession(session.sessionId, session);
    
    console.log(`✅ Force reloaded ${freshEvents.length} events`);
  } catch (error) {
    console.error('❌ Failed to force reload calendar events:', error);
    throw error;
  }
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
