// utils/auth.ts - Authentication with background calendar checking
// FIXED: checkCalendarsInBackground returns sourceKeys so callers can clean up
//        stale hiddenEvents entries. forceReloadEvents cleans them automatically.

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
 * Get current session – always uses in-memory cache first.
 * Background checking happens separately via /calendar/background-check.
 */
export async function getSession(
  c: Context,
  skipCalendarCheck: boolean = true
): Promise<any | null> {
  const sessionId = getCookie(c, 'session_id');
  if (!sessionId) return null;

  let session = activeSessions.get(sessionId);

  if (!session) {
    session = await loadSession(sessionId);
    if (session) activeSessions.set(sessionId, session);
  }

  if (!session) return null;

  session.sessionId = sessionId;
  return session;
}

/**
 * Background calendar check.
 * Returns `sourceKeys` – ALL event keys present in the current ICS sources
 * (before hiddenEvents filtering). Callers use this to prune stale entries
 * from session.hiddenEvents so events removed from the source are no longer
 * listed as "hidden".
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
  sourceKeys: string[];   // FIX: all keys present in source ICS
}> {
  const newHashes: Record<string, string> = {};
  let contentChanged = false;

  // Quick hash check (single fetch per calendar)
  for (const cal of calendarUrls) {
    try {
      const content = await fetchICS(cal.url, cal.name);
      const contentHash = simpleHash(content);
      newHashes[cal.id] = contentHash;
      const oldHash = cachedHashes[cal.id];
      if (!oldHash || oldHash !== contentHash) contentChanged = true;
    } catch {
      contentChanged = true;
    }
  }

  // Nothing changed – return early (sourceKeys = [] means "don't clean up")
  if (!contentChanged && Object.keys(cachedHashes).length > 0) {
    return { changed: false, events: [], hashes: cachedHashes, errors: [], sourceKeys: [] };
  }

  // Content changed – do a full reload
  const allEvents: any[] = [];
  const sourceKeys: string[] = [];
  const errors: string[] = [];

  for (const cal of calendarUrls) {
    try {
      const icsContent = await fetchICS(cal.url, cal.name);
      const contentHash = simpleHash(icsContent);
      newHashes[cal.id] = contentHash;

      const result = parseICS(icsContent, cal.id);

      result.events.forEach((e: any) => {
        const eventKey = `${cal.id}_${e.summary}_${e.start.toISOString()}`;

        // Track ALL source keys (used for stale-hiddenEvent cleanup by caller)
        sourceKeys.push(eventKey);

        if (hiddenEvents.includes(eventKey)) return;  // skip hidden

        allEvents.push({
          ...e,
          calendarId: cal.id,
          start: e.start.toISOString(),
          end: e.end.toISOString(),
          id: e.id ?? Math.random().toString(36).substr(2, 9)
        });
      });
    } catch (error: any) {
      errors.push(`${cal.name}: ${error.message}`);
    }
  }

  return { changed: true, events: allEvents, hashes: newHashes, errors, sourceKeys };
}

/**
 * Simple non-cryptographic hash for change detection.
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
 * Create a new session and set the session cookie.
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
    maxAge: 60 * 60 * 24 * 7  // 7 days
  });

  return sessionId;
}

/**
 * Save session data to persistent storage.
 */
export async function saveSessionData(session: any): Promise<void> {
  if (!session.sessionId) return;

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
      console.log(`✓ Saved user settings for ${session.username}`);
    } catch (error: any) {
      console.error('Save failed:', error.message);
    }
  }
}

/**
 * Force-reload all events from ICS sources.
 * FIXED: also cleans up stale hiddenEvents entries whose source events are
 *        no longer present in any calendar URL (i.e. removed from source).
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

  // FIX: prune stale hiddenEvents – keep only keys still present in source
  if (result.sourceKeys.length > 0) {
    const sourceKeySet = new Set(result.sourceKeys);
    session.hiddenEvents = (session.hiddenEvents || []).filter(
      (k: string) => sourceKeySet.has(k)
    );
  }

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
 * Get calendar reload status for UI display.
 */
export function getReloadStatus(session: any): {
  lastReload: number | null;
  minutesSince: number | null;
} {
  if (!session.lastEventReload) return { lastReload: null, minutesSince: null };
  const minutesSince = Math.floor((Date.now() - session.lastEventReload) / 60000);
  return { lastReload: session.lastEventReload, minutesSince };
}

/**
 * Reload all events from calendar URLs with hash tracking.
 * Returns `sourceKeys` – all event keys found in the source ICS files
 * (before hiddenEvents filtering) so callers can clean up stale entries.
 */
async function reloadCalendarEventsWithHashes(
  calendarUrls: any[],
  hiddenEvents: string[] = []
): Promise<{
  events: any[];
  errors: string[];
  hashes: Record<string, string>;
  sourceKeys: string[];  // FIX: keys of all events in source
}> {
  const allEvents: any[] = [];
  const sourceKeys: string[] = [];
  const errors: string[] = [];
  const hashes: Record<string, string> = {};

  for (const cal of calendarUrls) {
    try {
      const icsContent = await fetchICS(cal.url, cal.name);
      const contentHash = simpleHash(icsContent);
      hashes[cal.id] = contentHash;

      const result = parseICS(icsContent, cal.id);

      result.events.forEach((e: any) => {
        const eventKey = `${cal.id}_${e.summary}_${e.start.toISOString()}`;
        sourceKeys.push(eventKey);

        if (hiddenEvents.includes(eventKey)) return;  // skip hidden

        allEvents.push({
          ...e,
          calendarId: cal.id,
          start: e.start.toISOString(),
          end: e.end.toISOString(),
          id: e.id ?? Math.random().toString(36).substr(2, 9)
        });
      });
    } catch (error: any) {
      errors.push(`${cal.name}: ${error.message}`);
    }
  }

  return { events: allEvents, errors, hashes, sourceKeys };
}

/**
 * Fetch ICS content from URL with fallback to CORS proxy.
 * Uploaded files (non-HTTP URLs) are not re-fetchable.
 */
async function fetchICS(url: string, name: string): Promise<string> {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error(`Cannot refetch uploaded file: ${name}`);
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch {
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error(`Proxy HTTP ${response.status}`);
    return await response.text();
  }
}

/**
 * Load Swedish holidays for current and next year.
 */
export async function loadHolidays(): Promise<Record<string, string>> {
  const currentYear = new Date().getFullYear();
  const holidays = await fetchSwedishHolidays(currentYear);
  const nextYearHolidays = await fetchSwedishHolidays(currentYear + 1);
  return { ...holidays, ...nextYearHolidays };
}

/**
 * Require authentication middleware helper.
 */
export async function requireAuth(c: Context): Promise<any | null> {
  const session = await getSession(c);
  if (!session) {
    return c.redirect('/login');
  }
  return session;
}

/**
 * Destroy session and clear cookie.
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
 * Authenticate user and load settings from encrypted storage.
 * Called once at login time.
 */
export async function authenticateUser(
  username: string,
  password: string
): Promise<{
  settings: any;
  events: any[];
  hiddenEvents: string[];
  holidays: Record<string, string>;
  calendarHashes: Record<string, string>;
}> {
  const userHash = hashUsername(username);
  const encryptedData = await loadUserSettings(userHash);

  let settings: any;
  let events: any[] = [];
  let hiddenEvents: string[] = [];
  let holidays: Record<string, string> = {};
  let calendarHashes: Record<string, string> = {};

  if (encryptedData) {
    try {
      const decryptedData = decrypt(encryptedData, password);
      hiddenEvents = decryptedData.hiddenEvents ?? [];
      holidays = decryptedData.holidays ?? {};

      settings = {
        ...defaultSettings,
        ...decryptedData
      };
      delete settings.events;
      delete settings.hiddenEvents;
      delete settings.holidays;

      if (!Array.isArray(settings.calendarUrls)) settings.calendarUrls = [];
      if (!Array.isArray(settings.profiles)) settings.profiles = defaultSettings.profiles;
      if (!Array.isArray(settings.keywordRules)) settings.keywordRules = defaultSettings.keywordRules;

      if (Array.isArray(settings.calendarUrls) && settings.calendarUrls.length > 0) {
        const result = await reloadCalendarEventsWithHashes(settings.calendarUrls, hiddenEvents);
        events = result.events;
        calendarHashes = result.hashes;

        // Clean up stale hiddenEvents on login too
        if (result.sourceKeys.length > 0) {
          const sourceKeySet = new Set(result.sourceKeys);
          hiddenEvents = hiddenEvents.filter((k: string) => sourceKeySet.has(k));
        }

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
    settings = { ...defaultSettings };
    const encrypted = encrypt(settings, password);
    await saveUserSettings(userHash, encrypted);
  }

  return { settings, events, hiddenEvents, holidays, calendarHashes };
}
