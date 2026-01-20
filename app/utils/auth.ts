// utils/auth.ts - Authentication with background calendar checking
// NEW: Separate function for background calendar checks

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

const activeSessions = new Map<string, any>();

export function generateSessionId(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Get current session - ALWAYS use cached data
 * Background checking happens separately via /calendar/check-changes
 */
export async function getSession(c: Context, skipCalendarCheck: boolean = true): Promise<any | null> {
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

  session.sessionId = sessionId;
  return session;
}

/**
 * NEW: Background calendar check function
 * Checks for changes without blocking the main request
 */
export async function checkCalendarsInBackground(
  calendarUrls: any[],
  cachedHashes: Record<string, string>,
  hiddenEvents: string[] = []
): Promise<{
  changed: boolean;
  events: any[];
  hashes: Record<string, string>;
  errors: string[];
}> {
  const newHashes: Record<string, string> = {};
  let contentChanged = false;
  
  // Quick hash check first
  for (const calendar of calendarUrls) {
    try {
      const content = await fetchICS(calendar.url, calendar.name);
      const contentHash = simpleHash(content);
      newHashes[calendar.id] = contentHash;
      
      const oldHash = cachedHashes[calendar.id];
      
      if (!oldHash || oldHash !== contentHash) {
        contentChanged = true;
      }
    } catch (error) {
      contentChanged = true;
    }
  }
  
  // If nothing changed, return early
  if (!contentChanged && Object.keys(cachedHashes).length > 0) {
    return {
      changed: false,
      events: [],
      hashes: cachedHashes,
      errors: []
    };
  }
  
  // Content changed - reload all events
  const allEvents: any[] = [];
  const errors: string[] = [];
  
  for (const calendar of calendarUrls) {
    try {
      const icsContent = await fetchICS(calendar.url, calendar.name);
      const contentHash = simpleHash(icsContent);
      newHashes[calendar.id] = contentHash;
      
      const result = parseICS(icsContent, calendar.id);
      
      result.events.forEach((e: any) => {
        const eventKey = `${calendar.id}_${e.summary}_${e.start.toISOString()}`;
        
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
    } catch (error: any) {
      errors.push(`${calendar.name}: ${error.message}`);
    }
  }
  
  return {
    changed: true,
    events: allEvents,
    hashes: newHashes,
    errors
  };
}

/**
 * Simple hash function for content comparison
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(36);
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
    calendarHashes: sessionData.calendarHashes ?? {},
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
  let calendarHashes: Record<string, string> = {};

  if (existingData) {
    try {
      const decryptedData = decrypt(existingData, password);

      hiddenEvents = decryptedData.hiddenEvents ?? [];
      holidays = decryptedData.holidays ?? {};

      settings = { ...decryptedData };
      delete settings.events;
      delete settings.hiddenEvents;
      delete settings.holidays;

      if (Array.isArray(settings.calendarUrls) && settings.calendarUrls.length > 0) {
        const result = await reloadCalendarEventsWithHashes(settings.calendarUrls, hiddenEvents);
        events = result.events;
        calendarHashes = result.hashes;
        
        if (result.errors.length > 0) {
          console.log(`✓ Loaded ${events.length} events from ${settings.calendarUrls.length} calendar(s)`);
          console.log(`✗ Calendar errors:\n  - ${result.errors.join('\n  - ')}`);
        } else {
          console.log(`✓ Loaded ${events.length} events from ${settings.calendarUrls.length} calendar(s)`);
        }
      }
    } catch {
      throw new Error('Fel lösenord');
    }
  } else {
    settings = defaultSettings;
    const encrypted = encrypt(settings, password);
    await saveUserSettings(userHash, encrypted);
  }

  return { settings, events, hiddenEvents, holidays, calendarHashes };
}

/**
 * Reload all events from calendar URLs
 */
async function reloadCalendarEventsWithHashes(
  calendarUrls: any[],
  hiddenEvents: string[] = []
): Promise<{ events: any[], errors: string[], hashes: Record<string, string> }> {
  const allEvents: any[] = [];
  const errors: string[] = [];
  const hashes: Record<string, string> = {};

  for (const calendar of calendarUrls) {
    try {
      const icsContent = await fetchICS(calendar.url, calendar.name);
      const contentHash = simpleHash(icsContent);
      hashes[calendar.id] = contentHash;
      
      const result = parseICS(icsContent, calendar.id);

      result.events.forEach((e: any) => {
        const eventKey = `${calendar.id}_${e.summary}_${e.start.toISOString()}`;
        
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
    } catch (error: any) {
      errors.push(`${calendar.name}: ${error.message}`);
    }
  }

  return { events: allEvents, errors, hashes };
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
 */
export async function saveSessionData(session: any): Promise<void> {
  if (!session.sessionId) {
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
    } catch (error: any) {
      console.error('Save failed:', error.message);
    }
  }
}

/**
 * Force reload events for current session
 */
export async function forceReloadEvents(session: any): Promise<void> {
  if (!session.settings?.calendarUrls?.length) {
    throw new Error('Inga kalendrar att uppdatera');
  }

  const result = await reloadCalendarEventsWithHashes(
    session.settings.calendarUrls, 
    session.hiddenEvents || []
  );
  
  session.events = result.events;
  session.calendarHashes = result.hashes;
  session.lastEventReload = Date.now();
  
  activeSessions.set(session.sessionId, session);
  await saveSession(session.sessionId, session);
  
  if (result.errors.length > 0) {
    console.log(`✓ Reloaded ${result.events.length} events from ${session.settings.calendarUrls.length} calendar(s)`);
    console.log(`✗ Calendar errors:\n  - ${result.errors.join('\n  - ')}`);
  } else {
    console.log(`✓ Reloaded ${result.events.length} events from ${session.settings.calendarUrls.length} calendar(s)`);
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
