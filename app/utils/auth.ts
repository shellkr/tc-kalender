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
  fetchSwedishHolidays
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
  holidays: any
): string {
  const sessionId = generateSessionId();
  const userHash = hashUsername(username);

  const sessionData = {
    username,
    userHash,
    password,
    settings,
    events: [],
    hiddenEvents: [],
    holidays
  };

  activeSessions.set(sessionId, sessionData);
  saveSession(sessionId, sessionData);

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

  if (existingData) {
    try {
      settings = decrypt(existingData, password);
    } catch {
      throw new Error('Fel lösenord');
    }
  } else {
    settings = defaultSettings;
    const encrypted = encrypt(settings, password);
    await saveUserSettings(userHash, encrypted);
  }

  return settings;
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
export function requireAuth(c: Context): any | null {
  const session = getSession(c);

  if (!session) {
    return c.redirect('/login');
  }

  return session;
}

/**
 * Save session data to persistent storage
 */
export function saveSessionData(session: any): void {
  if (session.sessionId) {
    activeSessions.set(session.sessionId, session);
    saveSession(session.sessionId, session);
  }
}
