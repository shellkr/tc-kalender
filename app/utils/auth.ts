// utils/auth.ts – Authentication and session management utilities

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

  if (session) {
    session.sessionId = sessionId;
  }

  return session ?? null;
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
    holidays: sessionData.holidays ?? {}
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

      events = decryptedData.events ?? [];
      hiddenEvents = decryptedData.hiddenEvents ?? [];
      holidays = decryptedData.holidays ?? {};

      settings = { ...decryptedData };
      delete settings.events;
      delete settings.hiddenEvents;
      delete settings.holidays;

      console.log(
        `✅ Loaded ${events.length} stored events for user: ${userHash}`
      );

      if (
        Array.isArray(settings.calendarUrls) &&
        settings.calendarUrls.length > 0
      ) {
        console.log(
          `🔄 Fetching fresh events from ${settings.calendarUrls.length} calendars...`
        );

        events = [];

        for (const calendar of settings.calendarUrls) {
          try {
            console.log(`📥 Fetching calendar: ${calendar.name}`);

            const icsContent = await fetchICS(
              calendar.url,
              calendar.name
            );
            const result = parseICS(icsContent, calendar.id);

            result.events.forEach((e: any) => {
              events.push({
                ...e,
                calendarId: calendar.id,
                start: e.start.toISOString(),
                end: e.end.toISOString(),
                id:
                  e.id ??
                  Math.random().toString(36).substr(2, 9)
              });
            });

            console.log(
              `✅ Loaded ${result.events.length} events from ${calendar.name}`
            );
          } catch (error) {
            console.error(
              `❌ Failed to fetch calendar ${calendar.name}:`,
              error
            );
          }
        }

        console.log(`🎉 Total events loaded: ${events.length}`);
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
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Direct fetch failed');
    }

    return await response.text();
  } catch {
    console.log(
      `⚠️  Direct fetch failed for ${name}, trying CORS proxy...`
    );

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
        events: session.events ?? [],
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
