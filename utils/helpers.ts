// Date and time formatting utilities

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export function parseICSDate(dateStr: string): Date {
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

// Parse RRULE and expand recurring events
function parseRRule(rruleStr: string, dtstart: Date): { freq: string; until?: Date; interval?: number; byday?: string[] } | null {
  if (!rruleStr) return null;
  
  const parts: Record<string, string> = {};
  rruleStr.split(';').forEach(part => {
    const [key, value] = part.split('=');
    if (key && value) {
      parts[key.trim()] = value.trim();
    }
  });
  
  const result: any = {
    freq: parts.FREQ || 'WEEKLY',
    interval: parseInt(parts.INTERVAL || '1')
  };
  
  if (parts.UNTIL) {
    result.until = parseICSDate(parts.UNTIL);
  }
  
  if (parts.BYDAY) {
    result.byday = parts.BYDAY.split(',');
  }
  
  return result;
}

// Day name to day index mapping
const dayMap: Record<string, number> = {
  'SU': 0, 'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6
};

// Expand recurring events based on RRULE
function expandRecurrence(event: any, rrule: any): any[] {
  const occurrences: any[] = [];
  const startDate = new Date(event.start);
  const endDate = new Date(event.end);
  const duration = endDate.getTime() - startDate.getTime();
  
  // Limit expansion to prevent infinite loops
  const maxOccurrences = 500;
  const maxDate = rrule.until || new Date(startDate.getFullYear() + 2, 11, 31);
  
  let currentDate = new Date(startDate);
  let occurrenceCount = 0;
  
  while (currentDate <= maxDate && occurrenceCount < maxOccurrences) {
    // Check if this date matches the BYDAY rule
    let matchesByDay = true;
    if (rrule.byday && rrule.byday.length > 0) {
      const dayOfWeek = currentDate.getDay();
      matchesByDay = rrule.byday.some((day: string) => {
        return dayMap[day] === dayOfWeek;
      });
    }
    
    if (matchesByDay && currentDate >= startDate) {
      const occurrenceStart = new Date(currentDate);
      const occurrenceEnd = new Date(currentDate.getTime() + duration);
      
      occurrences.push({
        ...event,
        start: occurrenceStart,
        end: occurrenceEnd,
        id: `${event.id}_${occurrenceCount}`
      });
      
      occurrenceCount++;
    }
    
    // Move to next interval
    if (rrule.freq === 'WEEKLY') {
      currentDate.setDate(currentDate.getDate() + 7 * (rrule.interval || 1));
    } else if (rrule.freq === 'DAILY') {
      currentDate.setDate(currentDate.getDate() + (rrule.interval || 1));
    } else if (rrule.freq === 'MONTHLY') {
      currentDate.setMonth(currentDate.getMonth() + (rrule.interval || 1));
    } else if (rrule.freq === 'YEARLY') {
      currentDate.setFullYear(currentDate.getFullYear() + (rrule.interval || 1));
    } else {
      // Unknown frequency, break to avoid infinite loop
      break;
    }
  }
  
  return occurrences;
}

export function parseICS(icsContent: string, calendarId: string) {
  const lines = icsContent.split(/\r\n|\n|\r/);
  const events: any[] = [];
  let currentEvent: any = null;
  let calendarName: string | null = null;
  let currentRRule: string | null = null;
  let isReadingMultiLine = false;
  let multiLineProperty = '';
  let multiLineValue = '';

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // Handle line continuation (lines starting with space or tab)
    if (line.startsWith(' ') || line.startsWith('\t')) {
      if (isReadingMultiLine) {
        multiLineValue += line.substring(1);
      }
      continue;
    }
    
    // Process any accumulated multi-line property
    if (isReadingMultiLine && currentEvent) {
      if (multiLineProperty === 'UID') {
        currentEvent.id = multiLineValue;
      }
      isReadingMultiLine = false;
    }
    
    const trimmed = line.trim();

    if (trimmed.startsWith('X-WR-CALNAME:')) {
      calendarName = trimmed.substring(13).trim();
    }

    if (trimmed === 'BEGIN:VEVENT') {
      currentEvent = { calendarId, id: Math.random().toString(36).substr(2, 9) };
      currentRRule = null;
    } else if (trimmed === 'END:VEVENT' && currentEvent) {
      if (currentEvent.start && currentEvent.end && currentEvent.summary) {
        // Check if this event has a recurrence rule
        if (currentRRule) {
          const rrule = parseRRule(currentRRule, currentEvent.start);
          if (rrule) {
            // Expand recurring events
            const occurrences = expandRecurrence(currentEvent, rrule);
            events.push(...occurrences);
          } else {
            // If RRULE parsing fails, add single event
            events.push(currentEvent);
          }
        } else {
          // Single event without recurrence
          events.push(currentEvent);
        }
      }
      currentEvent = null;
      currentRRule = null;
    } else if (currentEvent) {
      if (trimmed.startsWith('SUMMARY:')) {
        currentEvent.summary = trimmed.substring(8);
      } else if (trimmed.startsWith('DTSTART')) {
        const dateValue = trimmed.includes(':') ? trimmed.split(':')[1] : trimmed.split('=')[1];
        currentEvent.start = parseICSDate(dateValue);
      } else if (trimmed.startsWith('DTEND')) {
        const dateValue = trimmed.includes(':') ? trimmed.split(':')[1] : trimmed.split('=')[1];
        currentEvent.end = parseICSDate(dateValue);
      } else if (trimmed.startsWith('DESCRIPTION:')) {
        currentEvent.description = trimmed.substring(12);
      } else if (trimmed.startsWith('UID:')) {
        // Start multi-line accumulation for UID
        isReadingMultiLine = true;
        multiLineProperty = 'UID';
        multiLineValue = trimmed.substring(4);
      } else if (trimmed.startsWith('RRULE:')) {
        currentRRule = trimmed.substring(6);
      }
    }
  }

  console.log(`Parsed ${events.length} events from calendar: ${calendarName || 'Unknown'}`);
  return { events, calendarName };
}

// Event color matching
export function getEventColor(summary: string, rules: any[]): { bg: string; text: string } {
  const lowerSummary = summary.toLowerCase();
  
  for (const rule of rules) {
    if (rule.keywords && Array.isArray(rule.keywords)) {
      for (const keyword of rule.keywords) {
        if (lowerSummary.includes(keyword.toLowerCase())) {
          return {
            bg: rule.color || 'rgb(183, 183, 183)',
            text: rule.textColor || '#ffffff'
          };
        }
      }
    }
  }
  
  // Default color if no rule matches
  return { bg: 'rgb(183, 183, 183)', text: '#ffffff' };
}

// Swedish day and month names
export const swedishDays = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];
export const swedishMonths = [
  'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
  'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
];

export function getSwedishDayName(dayIndex: number): string {
  return swedishDays[(dayIndex + 6) % 7]; // Convert Sunday=0 to Monday=0
}

export function getSwedishMonthName(monthIndex: number): string {
  return swedishMonths[monthIndex];
}

// Encryption helpers
export function hashPassword(password: string): string {
  // Simple hash for server-side - in production use bcrypt or similar
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function hashUsername(username: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(username.toLowerCase()).digest('hex').substring(0, 16);
}

export function encrypt(data: any, password: string): string {
  const json = JSON.stringify(data);
  const key = hashPassword(password);
  // Simple encoding - in production use proper encryption
  return Buffer.from(json + '::' + key).toString('base64');
}

export function decrypt(encrypted: string, password: string): any {
  try {
    const decoded = Buffer.from(encrypted, 'base64').toString('utf-8');
    const [json, key] = decoded.split('::');
    const expectedKey = hashPassword(password);
    if (key !== expectedKey) {
      throw new Error('Invalid password');
    }
    return JSON.parse(json);
  } catch (error) {
    throw new Error('Fel lösenord eller korrupt data');
  }
}

// Default settings for new users
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
