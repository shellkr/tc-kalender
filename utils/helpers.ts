// utils/helpers.ts - Utility functions for parsing and data manipulation

export interface Event {
  id: string;
  calendarId: string;
  summary: string;
  start: string;
  end: string;
  description?: string;
}

export interface ParseResult {
  events: Event[];
  calendarName: string | null;
}

/**
 * Default settings for new users
 */
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

/**
 * Fetch Swedish holidays from API with caching
 */
export async function fetchSwedishHolidays(year: number): Promise<Record<string, string>> {
  try {
    console.log('Fetching Swedish holidays for year:', year);
    
    const url = `https://sholiday.faboul.se/dagar/v2.1/${year}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
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
    
    console.log(`Fetched ${Object.keys(holidays).length} holidays for ${year}`);
    return holidays;
    
  } catch (error) {
    console.error('Error fetching holidays:', error);
    return getCalculatedHolidays(year);
  }
}

/**
 * Calculate holidays using Easter algorithm
 */
function getCalculatedHolidays(year: number): Record<string, string> {
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
  
  holidays[formatDateToString(addDays(easterDate, -2))] = 'Långfredagen';
  holidays[formatDateToString(addDays(easterDate, -1))] = 'Påskafton';
  holidays[formatDateToString(easterDate)] = 'Påskdagen';
  holidays[formatDateToString(addDays(easterDate, 1))] = 'Annandag påsk';
  holidays[formatDateToString(addDays(easterDate, 39))] = 'Kristi himmelsfärdsdag';
  holidays[formatDateToString(addDays(easterDate, 49))] = 'Pingstdagen';
  
  const midsummerEve = getMidsummerEve(year);
  holidays[formatDateToString(midsummerEve)] = 'Midsommarafton';
  holidays[formatDateToString(addDays(midsummerEve, 1))] = 'Midsommardagen';
  
  const allSaintsDay = getAllSaintsDay(year);
  holidays[formatDateToString(allSaintsDay)] = 'Alla helgons dag';
  
  return holidays;
}

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

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDateToString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parse ICS content and extract events
 * Fixed to handle multi-line properties correctly
 */
export function parseICS(icsContent: string, calendarId: string): ParseResult {
  // First, unfold lines (handle line continuations)
  const unfoldedContent = icsContent.replace(/\r?\n[ \t]/g, '');
  const lines = unfoldedContent.split(/\r?\n/);
  
  const events: any[] = [];
  let currentEvent: any = null;
  let calendarName: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (!line) continue;

    // Extract calendar name
    if (line.startsWith('X-WR-CALNAME:')) {
      calendarName = line.substring(13).trim();
    }

    // Begin event
    if (line === 'BEGIN:VEVENT') {
      currentEvent = { 
        calendarId,
        id: Math.random().toString(36).substr(2, 9) 
      };
    } 
    // End event
    else if (line === 'END:VEVENT' && currentEvent) {
      if (currentEvent.start && currentEvent.end && currentEvent.summary) {
        // Convert date strings to Date objects for the result
        currentEvent.start = parseDateStringToDate(currentEvent.start);
        currentEvent.end = parseDateStringToDate(currentEvent.end);
        events.push(currentEvent);
      }
      currentEvent = null;
    } 
    // Parse event properties
    else if (currentEvent) {
      if (line.startsWith('SUMMARY:')) {
        currentEvent.summary = line.substring(8);
      } 
      else if (line.startsWith('DTSTART')) {
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
          currentEvent.start = line.substring(colonIndex + 1);
        }
      } 
      else if (line.startsWith('DTEND')) {
        const colonIndex = line.indexOf(':');
        if (colonIndex !== -1) {
          currentEvent.end = line.substring(colonIndex + 1);
        }
      } 
      else if (line.startsWith('DESCRIPTION:')) {
        currentEvent.description = line.substring(12);
      } 
      else if (line.startsWith('UID:')) {
        currentEvent.id = line.substring(4);
      }
    }
  }

  console.log(`Parsed ${events.length} events from calendar`);
  return { events, calendarName };
}

/**
 * Parse ICS date string to Date object
 */
function parseDateStringToDate(dateStr: string): Date {
  const year = parseInt(dateStr.substring(0, 4));
  const month = parseInt(dateStr.substring(4, 6)) - 1;
  const day = parseInt(dateStr.substring(6, 8));
  
  if (dateStr.length > 8 && dateStr.includes('T')) {
    const hour = parseInt(dateStr.substring(9, 11));
    const minute = parseInt(dateStr.substring(11, 13));
    const second = parseInt(dateStr.substring(13, 15));
    return new Date(year, month, day, hour, minute, second);
  }
  
  return new Date(year, month, day);
}

/**
 * Format date for display (Swedish locale)
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('sv-SE');
}

/**
 * Format time for display (Swedish locale)
 */
export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Check if event is a whole-day event
 */
export function isWholeDayEvent(event: any): boolean {
  const start = new Date(event.start);
  const end = new Date(event.end);
  
  return (
    start.getHours() === 0 && 
    start.getMinutes() === 0 && 
    end.getHours() === 0 && 
    end.getMinutes() === 0 &&
    end.getDate() !== start.getDate()
  );
}

/**
 * Get week number (ISO 8601)
 */
export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/**
 * Get Swedish day name
 */
export function getSwedishDayName(date: Date): string {
  const days = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
  return days[date.getDay()];
}

/**
 * Get Swedish month name
 */
export function getSwedishMonthName(monthIndex: number): string {
  const months = [
    'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
    'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
  ];
  return months[monthIndex];
}

/**
 * Hash password using SHA-256
 */
export function hashPassword(password: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Hash username to create unique identifier
 */
export function hashUsername(username: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(username.toLowerCase()).digest('hex').substring(0, 16);
}

/**
 * Simple encryption (base64 + key verification)
 */
export function encrypt(data: any, password: string): string {
  const json = JSON.stringify(data);
  const key = hashPassword(password);
  return Buffer.from(json + '::' + key).toString('base64');
}

/**
 * Simple decryption
 */
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

/**
 * Get event color based on keyword rules
 */
export function getEventColor(summary: string, rules: any[]): { bg: string, text: string } {
  const lowerSummary = summary.toLowerCase();
  for (const rule of rules) {
    if (rule.keywords.some((k: string) => lowerSummary.includes(k.toLowerCase()))) {
      return { bg: rule.color, text: rule.textColor || '#ffffff' };
    }
  }
  return { bg: 'rgb(183, 183, 183)', text: '#ffffff' };
}

/**
 * Check if event is in the past
 */
export function isEventPast(event: any): boolean {
  const now = new Date();
  const eventEnd = new Date(event.end || event.start);
  
  if (isWholeDayEvent(event)) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(event.start);
    eventDate.setHours(0, 0, 0, 0);
    return eventDate < today;
  } else {
    return eventEnd < now;
  }
}

/**
 * Generate date range
 */
export function generateDateRange(startDate: Date, days: number = 365): Date[] {
  const dates: Date[] = [];
  const current = new Date(startDate);
  
  for (let i = 0; i < days; i++) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

/**
 * Filter events by visible calendars and hidden events
 */
export function filterEvents(
  events: any[], 
  visibleCalendarIds: string[], 
  hiddenEventKeys: string[]
): any[] {
  return events.filter(event => {
    // Check if calendar is visible
    if (event.calendarId && !visibleCalendarIds.includes(event.calendarId)) {
      return false;
    }
    
    // Check if event is hidden
    const eventKey = `${event.calendarId}_${event.summary}_${event.start}`;
    if (hiddenEventKeys.includes(eventKey)) {
      return false;
    }
    
    return true;
  });
}

/**
 * Sort events by start date
 */
export function sortEventsByDate(events: any[]): any[] {
  return [...events].sort((a, b) => {
    const dateA = new Date(a.start);
    const dateB = new Date(b.start);
    return dateA.getTime() - dateB.getTime();
  });
}

/**
 * Group events by date
 */
export function groupEventsByDate(events: any[]): Map<string, any[]> {
  const grouped = new Map<string, any[]>();
  
  for (const event of events) {
    const date = new Date(event.start);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(event);
  }
  
  return grouped;
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
