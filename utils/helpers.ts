import { createHash } from 'crypto';

export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export function hashUsername(username: string): string {
  return createHash('sha256').update(username.toLowerCase()).digest('hex').substring(0, 16);
}

export function encrypt(data: any, password: string): string {
  const json = JSON.stringify(data);
  const key = hashPassword(password);
  return Buffer.from(json + '::' + key).toString('base64');
}

export function decrypt(encrypted: string, password: string): any {
  try {
    const decoded = Buffer.from(encrypted, 'base64').toString('utf-8');
    const [json, key] = decoded.split('::');
    const expectedKey = hashPassword(password);
    if (key !== expectedKey) throw new Error('Invalid password');
    return JSON.parse(json);
  } catch {
    throw new Error('Fel lösenord eller korrupt data');
  }
}

export function parseDateString(dateStr: string): Date {
  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6)) - 1;
  const day = parseInt(dateStr.substring(6, 8));
  
  if (dateStr.length > 8) {
    const hour = parseInt(dateStr.substring(9, 11));
    const minute = parseInt(dateStr.substring(11, 13));
    const second = parseInt(dateStr.substring(13, 15));
    return new Date(year, month, day, hour, minute, second);
  }
  
  return new Date(year, month, day);
}

export function parseICS(icsContent: string, calendarId: string) {
  const lines = icsContent.split(/\r\n|\n|\r/);
  const events: any[] = [];
  let currentEvent: any = null;
  let calendarName = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('X-WR-CALNAME:')) {
      calendarName = trimmed.substring(13).trim();
    }

    if (trimmed === 'BEGIN:VEVENT') {
      currentEvent = { calendarId, id: Math.random().toString(36).substr(2, 9) };
    } else if (trimmed === 'END:VEVENT' && currentEvent) {
      if (currentEvent.start && currentEvent.end && currentEvent.summary) {
        // Convert date strings to Date objects
        currentEvent.start = parseDateString(currentEvent.start);
        currentEvent.end = parseDateString(currentEvent.end);
        events.push(currentEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      if (trimmed.startsWith('SUMMARY:')) {
        currentEvent.summary = trimmed.substring(8);
      } else if (trimmed.startsWith('DTSTART')) {
        currentEvent.start = trimmed.split(':')[1];
      } else if (trimmed.startsWith('DTEND')) {
        currentEvent.end = trimmed.split(':')[1];
      } else if (trimmed.startsWith('DESCRIPTION:')) {
        currentEvent.description = trimmed.substring(12);
      } else if (trimmed.startsWith('UID:')) {
        currentEvent.id = trimmed.substring(4);
      }
    }
  }

  return { events, calendarName };
}

export const defaultSettings = {
  calendarUrls: [],
  keywordRules: [
    { id: 'kti', keywords: ['kti'], color: '#ff6b35', textColor: '#ffffff', name: 'KTI' },
    { id: 'lga', keywords: ['lga'], color: '#22c55e', textColor: '#ffffff', name: 'LGA' },
    { id: 'veto', keywords: ['veto'], color: '#ffffff', textColor: '#000000', name: 'VETO' },
    { id: 'ry', keywords: ['ry'], color: '#bfdbfe', textColor: '#000000', name: 'RY' },
    { id: 'byte', keywords: ['turbyte', 'byte'], color: '#a855f7', textColor: '#ffffff', name: 'Turbyte' },
  ],
  profiles: [{ id: 'default', name: 'Standard', calendarIds: [] }],
  activeProfileId: 'default',
  darkMode: false
};
