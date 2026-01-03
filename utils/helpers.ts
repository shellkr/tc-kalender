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
  
  if (dateStr.length > 8 && dateStr.includes('T')) {
    // Has time component
    const hour = parseInt(dateStr.substring(9, 11));
    const minute = parseInt(dateStr.substring(11, 13));
    const second = parseInt(dateStr.substring(13, 15));
    return new Date(year, month, day, hour, minute, second);
  }
  
  // For whole-day events (no time component), set to noon to avoid timezone issues
  // This prevents the date from shifting when converted to/from UTC
  return new Date(year, month, day, 12, 0, 0);
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

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function getEventColor(summary: string, rules: any[]) {
  const lowerSummary = summary.toLowerCase();
  for (const rule of rules) {
    if (rule.keywords.some((k: string) => lowerSummary.includes(k.toLowerCase()))) {
      return { bg: rule.color, text: rule.textColor || '#ffffff' };
    }
  }
  return { bg: 'rgb(183, 183, 183)', text: '#ffffff' };
}

export function formatEventTime(event: any): string {
  const start = new Date(event.start);
  const end = event.end ? new Date(event.end) : start;
  
  const isWholeDay = 
    start.getHours() === 0 && 
    start.getMinutes() === 0 && 
    end.getHours() === 0 && 
    end.getMinutes() === 0 &&
    end.getDate() !== start.getDate();
  
  if (isWholeDay) return 'Heldag';
  
  const startTime = start.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  
  if (end.getTime() !== start.getTime()) {
    const endTime = end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    return `${startTime}-${endTime}`;
  }
  
  return startTime;
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

export const swedishDays = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];
export const swedishMonths = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];
