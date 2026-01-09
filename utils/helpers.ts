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
  
  const maxOccurrences = 500;
  const maxDate = rrule.until || new Date(startDate.getFullYear() + 2, 11, 31);
  
  let currentDate = new Date(startDate);
  let occurrenceCount = 0;
  
  while (currentDate <= maxDate && occurrenceCount < maxOccurrences) {
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
    
    if (rrule.freq === 'WEEKLY') {
      currentDate.setDate(currentDate.getDate() + 7 * (rrule.interval || 1));
    } else if (rrule.freq === 'DAILY') {
      currentDate.setDate(currentDate.getDate() + (rrule.interval || 1));
    } else if (rrule.freq === 'MONTHLY') {
      currentDate.setMonth(currentDate.getMonth() + (rrule.interval || 1));
    } else if (rrule.freq === 'YEARLY') {
      currentDate.setFullYear(currentDate.getFullYear() + (rrule.interval || 1));
    } else {
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
    
    if (line.startsWith(' ') || line.startsWith('\t')) {
      if (isReadingMultiLine) {
        multiLineValue += line.substring(1);
      }
      continue;
    }
    
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
        if (currentRRule) {
          const rrule = parseRRule(currentRRule, currentEvent.start);
          if (rrule) {
            const occurrences = expandRecurrence(currentEvent, rrule);
            events.push(...occurrences);
          } else {
            events.push(currentEvent);
          }
        } else {
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
  
  return { bg: 'rgb(183, 183, 183)', text: '#ffffff' };
}

// Swedish day and month names
export const swedishDays = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];
export const swedishMonths = [
  'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
  'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
];

export function getSwedishDayName(dayIndex: number): string {
  return swedishDays[(dayIndex + 6) % 7];
}

export function getSwedishMonthName(monthIndex: number): string {
  return swedishMonths[monthIndex];
}

// Encryption helpers
export function hashPassword(password: string): string {
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

// ===== SWEDISH HOLIDAYS =====
const holidayCache: Map<number, Record<string, string>> = new Map();

// Calculate Easter using Computus algorithm
function calculateEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function getMidsummerEve(year: number): Date {
  const june19 = new Date(year, 5, 19);
  const dayOfWeek = june19.getDay();
  const daysToFriday = dayOfWeek === 0 ? 5 : (5 - dayOfWeek + 7) % 7;
  return addDays(june19, daysToFriday);
}

function getAllSaintsDay(year: number): Date {
  const oct31 = new Date(year, 9, 31);
  const dayOfWeek = oct31.getDay();
  const daysToSaturday = dayOfWeek === 6 ? 0 : (6 - dayOfWeek + 7) % 7;
  return addDays(oct31, daysToSaturday);
}

function calculateHolidays(year: number): Record<string, string> {
  const holidays: Record<string, string> = {};
  
  holidays[`${year}-01-01`] = 'Nyårsdagen';
  holidays[`${year}-01-06`] = 'Trettondedag jul';
  holidays[`${year}-05-01`] = 'Första maj';
  holidays[`${year}-06-06`] = 'Sveriges nationaldag';
  holidays[`${year}-12-24`] = 'Julafton';
  holidays[`${year}-12-25`] = 'Juldagen';
  holidays[`${year}-12-26`] = 'Annandag jul';
  holidays[`${year}-12-31`] = 'Nyårsafton';
  
  const easterDate = calculateEaster(year);
  holidays[formatDate(addDays(easterDate, -2))] = 'Långfredagen';
  holidays[formatDate(addDays(easterDate, -1))] = 'Påskafton';
  holidays[formatDate(easterDate)] = 'Påskdagen';
  holidays[formatDate(addDays(easterDate, 1))] = 'Annandag påsk';
  holidays[formatDate(addDays(easterDate, 39))] = 'Kristi himmelsfärdsdag';
  holidays[formatDate(addDays(easterDate, 49))] = 'Pingstdagen';
  
  const midsummerEve = getMidsummerEve(year);
  holidays[formatDate(midsummerEve)] = 'Midsommarafton';
  holidays[formatDate(addDays(midsummerEve, 1))] = 'Midsommardagen';
  
  const allSaintsDay = getAllSaintsDay(year);
  holidays[formatDate(allSaintsDay)] = 'Alla helgons dag';
  
  return holidays;
}

export async function fetchSwedishHolidays(year: number): Promise<Record<string, string>> {
  try {
    const cached = holidayCache.get(year);
    if (cached) {
      console.log('Using cached holidays for', year);
      return cached;
    }

    console.log('Fetching Swedish holidays for year:', year);
    
    const url = `https://sholiday.faboul.se/dagar/v2.1/${year}`;
    
    try {
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        const holidays: Record<string, string> = {};
        
        if (data.dagar && Array.isArray(data.dagar)) {
          data.dagar.forEach((day: any) => {
            if (day['röd dag'] === 'Ja' || day.helgdag) {
              const dateStr = day.datum;
              const name = day.helgdag || day.veckodag;
              holidays[dateStr] = name;
            }
          });
        }
        
        holidayCache.set(year, holidays);
        console.log(`Fetched ${Object.keys(holidays).length} holidays for ${year} from API`);
        return holidays;
      }
    } catch (apiError) {
      console.warn('API fetch failed, using calculated holidays:', apiError);
    }
    
    const calculatedHolidays = calculateHolidays(year);
    holidayCache.set(year, calculatedHolidays);
    console.log(`Using ${Object.keys(calculatedHolidays).length} calculated holidays for ${year}`);
    return calculatedHolidays;
    
  } catch (error) {
    console.error('Error fetching holidays:', error);
    const calculatedHolidays = calculateHolidays(year);
    holidayCache.set(year, calculatedHolidays);
    return calculatedHolidays;
  }
}

export function isHoliday(dateStr: string, holidays: Record<string, string>): boolean {
  return holidays && holidays[dateStr] !== undefined;
}

export function getHolidayName(dateStr: string, holidays: Record<string, string>): string | null {
  return holidays ? holidays[dateStr] : null;
}

export async function prefetchHolidays(years: number[]): Promise<void> {
  const promises = years.map(year => fetchSwedishHolidays(year));
  await Promise.all(promises);
}
