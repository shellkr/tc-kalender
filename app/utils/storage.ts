// utils/storage.ts - Fixed storage with events persistence
import { existsSync } from 'fs';
import { readFile, writeFile, mkdir, readdir, unlink, stat } from 'fs/promises';
import { join } from 'path';
import { encrypt, decrypt } from './helpers';

const STORAGE_DIR = process.env.STORAGE_DIR || '/var/www/storage';
const SESSIONS_DIR = join(STORAGE_DIR, 'sessions');

// Ensure storage directory exists
export async function initStorage() {
  try {
    if (!existsSync(STORAGE_DIR)) {
      await mkdir(STORAGE_DIR, { recursive: true });
      console.log(`✅ Created storage directory: ${STORAGE_DIR}`);
    }
  } catch (error) {
    console.error('❌ Failed to initialize storage:', error);
    throw error;
  }
}

/**
 * Load user settings AND events from file
 * THIS IS THE FIX - we now load the full data structure
 */
export async function loadUserSettings(userHash: string): Promise<string | null> {
  try {
    const filename = `${userHash}.json`;
    const filepath = join(STORAGE_DIR, filename);
    
    if (!existsSync(filepath)) {
      console.log(`No settings file found for user: ${userHash}`);
      return null;
    }
    
    const data = await readFile(filepath, 'utf-8');
    console.log(`✅ Loaded settings for user: ${userHash}`);
    return data;
  } catch (error) {
    console.error(`❌ Failed to load settings for user ${userHash}:`, error);
    return null;
  }
}

/**
 * Save user settings AND events to file
 * THIS IS THE FIX - we now save the full data structure
 */
export async function saveUserSettings(userHash: string, encryptedData: string): Promise<boolean> {
  try {
    const filename = `${userHash}.json`;
    const filepath = join(STORAGE_DIR, filename);
    
    await writeFile(filepath, encryptedData, 'utf-8');
    console.log(`✅ Saved settings for user: ${userHash}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to save settings for user ${userHash}:`, error);
    return false;
  }
}

// Session storage - simple file-based sessions
export async function initSessionStorage() {
  try {
    if (!existsSync(SESSIONS_DIR)) {
      await mkdir(SESSIONS_DIR, { recursive: true });
      console.log(`✅ Created sessions directory: ${SESSIONS_DIR}`);
    }
  } catch (error) {
    console.error('❌ Failed to initialize session storage:', error);
  }
}

export async function saveSession(sessionId: string, sessionData: any): Promise<boolean> {
  try {
    const filepath = join(SESSIONS_DIR, `${sessionId}.json`);
    await writeFile(filepath, JSON.stringify(sessionData), 'utf-8');
    return true;
  } catch (error) {
    console.error(`❌ Failed to save session ${sessionId}:`, error);
    return false;
  }
}

export async function loadSession(sessionId: string): Promise<any | null> {
  try {
    const filepath = join(SESSIONS_DIR, `${sessionId}.json`);
    
    if (!existsSync(filepath)) {
      return null;
    }
    
    const data = await readFile(filepath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`❌ Failed to load session ${sessionId}:`, error);
    return null;
  }
}

export async function deleteSession(sessionId: string): Promise<boolean> {
  try {
    const filepath = join(SESSIONS_DIR, `${sessionId}.json`);
    
    if (existsSync(filepath)) {
      await unlink(filepath);
      console.log(`✅ Deleted session: ${sessionId}`);
    }
    return true;
  } catch (error) {
    console.error(`❌ Failed to delete session ${sessionId}:`, error);
    return false;
  }
}

// Clean up old sessions (older than 7 days)
export async function cleanupOldSessions() {
  try {
    if (!existsSync(SESSIONS_DIR)) return;
    
    const files = await readdir(SESSIONS_DIR);
    const now = Date.now();
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    let cleaned = 0;
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      
      const filepath = join(SESSIONS_DIR, file);
      const stats = await stat(filepath);
      
      if (now - stats.mtimeMs > maxAge) {
        await unlink(filepath);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} old session(s)`);
    }
  } catch (error) {
    console.error('❌ Failed to clean up old sessions:', error);
  }
}
