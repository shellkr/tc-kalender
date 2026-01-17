// utils/auth.ts – Authentication and session management utilities
// REAL FIX: Force lastEventReload = 0 when loading session from disk

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
 * REAL FIX: Force reload timestamp to 0 when loading from disk
 */
export async function getSession(c: Context): Promise<any | null> {
  const sessionId = getCookie(c, 'session_id');
  if (!sessionId) {
    return null;
  }

  let session = activeSessions.get(sessionId);
  let wasLoadedFromDisk = false;

  if (!session) {
    session = await loadSession(sessionId);
    if (session) {
      // REAL FIX: When loading session from disk, force reload timestamp to 0
      // This ensures calendar URLs are always fetched fresh after server restart or session expiry
      session.lastEventReload = 0;
      wasLoadedFromDisk = true;
      activeSessions.set(sessionId, session);
      console.log(`📂 Loaded session from disk (will reload events)`);
    }
  }

  if (!session) {
    return null;
  }

  // Check if we need to reload events from calendar URLs
  // Reload if: 1) No events in session, 2) Calendar URLs exist, 3) More than 2 minutes since last reload
  const now = Date.now();
  const lastReload = session.lastEventReload || 0;
  const twoMinutes = 2 * 60 * 1000; // Reduced to 2 minutes
  const shouldReload = 
    (!session.events || session.events.length === 0) || 
    (session.settings?.calendarUrls?.length > 0 && (now - lastReload > twoMinutes));

  if (shouldReload && session.settings?.calendarUrls?.length > 0) {
    const minutesSince = lastReload > 0 ? Math.floor((now - lastReload) / 60000) : 'never';
    console.log(`🔄 Reloading ${session.settings.calendarUrls.length} calendar(s) (last: ${minutesSince})...`);
    
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
  } else if (session.events?.length > 0) {
    const secondsSince = Math.floor((now - lastReload) / 1000);
    console.log(`✓ Using cached events: ${session.events.length} events (${secondsSince}s old)`);
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
      console.log(`  📥 Fetching: ${calendar.name}`);
      
      const icsContent = await fetchICS(calendar.url, calendar.name);
      const result = parseICS(icsContent, calendar.id);

      let addedCount = 0;
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
        addedCount++;
      });

      console.log(`  ✅ ${calendar.name}: ${addedCount}/${result.events.length} events`);
    } catch (error) {
      console.error(`  ❌ ${calendar.name}: ${error.message}`);
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
    lastEventReload: Date.now()
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

      // Always fetch fresh events from calendar URLs on login
      if (Array.isArray(settings.calendarUrls) && settings.calendarUrls.length > 0) {
        console.log(`🔄 Loading fresh events from ${settings.calendarUrls.length} calendars...`);
        
        events = await reloadCalendarEvents(settings.calendarUrls, hiddenEvents);
        
        console.log(`🎉 Loaded ${events.length} total events`);
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
    throw new Error(`Cannot refetch uploaded file: ${name}. Please re-upload.`);
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } catch {
    console.log(`  ⚠️  Trying CORS proxy for ${name}...`);
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
    console.error('Could not save session data - session ID missing');
    return;
  }

  activeSessions.set(session.sessionId, session);
  await saveSession(session.sessionId, session);

  if (session.userHash && session.password && session.settings) {
    try {
      const dataToSave = {
        ...session.settings,
        hiddenEvents: session.hiddenEvents ?? [],
        holidays: session.holidays ?? {}
      };

      const encrypted = encrypt(dataToSave, session.password);
      await saveUserSettings(session.userHash, encrypted);
      console.log(`✅ Saved settings for user: ${session.userHash}`);
    } catch (error) {
      console.error('Failed to save user settings:', error);
    }
  }
}

/**
 * Force reload events for current session
 */
export async function forceReloadEvents(session: any): Promise<void> {
  if (!session.settings?.calendarUrls?.length) {
    console.log('No calendar URLs to reload');
    return;
  }

  console.log(`🔄 Force reloading ${session.settings.calendarUrls.length} calendar(s)...`);
  
  try {
    const freshEvents = await reloadCalendarEvents(session.settings.calendarUrls, session.hiddenEvents || []);
    session.events = freshEvents;
    session.lastEventReload = Date.now();
    
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
