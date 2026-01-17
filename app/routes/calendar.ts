// routes/calendar.ts - Calendar views, management, and event operations
// FIXED: Always call reloadEventsIfNeeded() before rendering calendar views

import { Hono } from 'hono';
import { getSession, saveSessionData, forceReloadEvents, getReloadStatus, reloadEventsIfNeeded } from '../utils/auth';
import { parseICS, fetchSwedishHolidays } from '../utils/helpers';
import { renderCalendarView } from '../views/layout';
import { renderListView } from '../views/listview';
import { renderMonthView } from '../views/monthview';
import { renderPrintView } from '../views/printview';

const calendar = new Hono();

// ==================== CALENDAR VIEWS ====================

/**
 * Main calendar view (shows view selector)
 */
calendar.get('/view/calendar', async (c) => {
  const session = await getSession(c);
  if (!session) return c.redirect('/login');
  
  return c.html(renderCalendarView(session));
});

/**
 * List view of calendar events
 * FIXED: Always check for fresh events before rendering
 */
calendar.get('/view/calendar/list', async (c) => {
  const session = await getSession(c);
  if (!session) return c.redirect('/login');
  
  // FIXED: Reload events if needed BEFORE rendering view
  await reloadEventsIfNeeded(session);
  
  // Ensure holidays are loaded
  if (!session.holidays || Object.keys(session.holidays).length === 0) {
    const currentYear = new Date().getFullYear();
    session.holidays = await fetchSwedishHolidays(currentYear);
  }
  
  const dateParam = c.req.query('date');
  const startDate = dateParam || new Date().toISOString().split('T')[0];
  const editModeParam = c.req.query('editMode');
  const isEditMode = editModeParam === 'true';
  
  return c.html(renderListView(session, startDate, isEditMode));
});

/**
 * Month view of calendar events
 * FIXED: Always check for fresh events before rendering
 */
calendar.get('/view/calendar/month', async (c) => {
  const session = await getSession(c);
  if (!session) return c.redirect('/login');
  
  // FIXED: Reload events if needed BEFORE rendering view
  await reloadEventsIfNeeded(session);
  
  // Ensure holidays are loaded
  if (!session.holidays || Object.keys(session.holidays).length === 0) {
    const currentYear = new Date().getFullYear();
    session.holidays = await fetchSwedishHolidays(currentYear);
  }
  
  const offsetParam = c.req.query('offset');
  const offset = offsetParam ? parseInt(offsetParam, 10) : 0;
  
  return c.html(renderMonthView(session, offset));
});

/**
 * Print view for calendar
 * FIXED: Always check for fresh events before rendering
 */
calendar.get('/view/calendar/print', async (c) => {
  const session = await getSession(c);
  if (!session) return c.redirect('/login');
  
  // FIXED: Reload events if needed BEFORE rendering view
  await reloadEventsIfNeeded(session);
  
  // Ensure holidays are loaded
  if (!session.holidays || Object.keys(session.holidays).length === 0) {
    const currentYear = new Date().getFullYear();
    session.holidays = await fetchSwedishHolidays(currentYear);
  }
  
  const startDate = c.req.query('date');
  return c.html(renderPrintView(session, startDate));
});

/**
 * Manual refresh endpoint - force reload all calendar events
 */
calendar.post('/calendar/refresh', async (c) => {
  const session = await getSession(c);
  if (!session) return c.text('');
  
  try {
    await forceReloadEvents(session);
    
    const isDarkMode = session.settings?.darkMode || false;
    const eventCount = session.events?.length || 0;
    
    return c.html(`
      <div class="p-3 bg-green-100 text-green-700 rounded mb-2">
        ✅ Kalendrar uppdaterade! ${eventCount} händelser laddade.
      </div>
      <script>
        setTimeout(() => {
          const calendarContent = document.getElementById('calendar-content');
          if (calendarContent) {
            const dateInput = document.getElementById('date-picker');
            const currentDate = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
            const editMode = document.querySelector('.event-checkbox') !== null;
            
            htmx.ajax('GET', '/view/calendar/list?date=' + currentDate + '&editMode=' + editMode, {
              target: '#calendar-content',
              swap: 'innerHTML'
            });
          }
        }, 1000);
      </script>
    `);
  } catch (error: any) {
    return c.html(`
      <div class="p-3 bg-red-100 text-red-700 rounded">
        ❌ Kunde inte uppdatera kalendrar: ${error.message}
      </div>
    `);
  }
});

/**
 * Get calendar refresh status
 */
calendar.get('/calendar/refresh-status', async (c) => {
  const session = await getSession(c);
  if (!session) return c.text('');
  
  const status = getReloadStatus(session);
  const isDarkMode = session.settings?.darkMode || false;
  
  if (status.secondsSince === null) {
    return c.html(`
      <span class="text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}">
        Aldrig uppdaterad
      </span>
    `);
  }
  
  let statusText = '';
  const seconds = status.secondsSince;
  
  if (seconds < 5) {
    statusText = 'Just nu';
  } else if (seconds < 60) {
    statusText = `${seconds} sekunder sedan`;
  } else if (seconds < 120) {
    statusText = '1 minut sedan';
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    statusText = `${minutes} minuter sedan`;
  } else {
    const hours = Math.floor(seconds / 3600);
    statusText = hours === 1 ? '1 timme sedan' : `${hours} timmar sedan`;
  }
  
  return c.html(`
    <span class="text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}">
      Uppdaterad: ${statusText}
    </span>
  `);
});

// ==================== CALENDAR MANAGEMENT ====================

/**
 * Add calendar from URL
 */
calendar.post('/calendar/add-url', async (c) => {
  const session = await getSession(c);
  if (!session) return c.text('');

  if (!session.settings.calendarUrls) {
    session.settings.calendarUrls = [];
  }
  
  const body = await c.req.parseBody();
  const url = body.url as string;
  
  if (!url || !url.trim()) {
    return c.html(`<div class="p-4 bg-red-100 text-red-700 rounded">URL krävs</div>`);
  }
  
  try {
    let icsContent;
    
    // Try direct fetch first
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Direct fetch failed');
      icsContent = await response.text();
    } catch (directError) {
      // Fallback to CORS proxy
      console.log('Direct fetch failed, trying CORS proxy...');
      const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
      const proxyResponse = await fetch(proxyUrl);
      if (!proxyResponse.ok) throw new Error('Proxy fetch failed');
      icsContent = await proxyResponse.text();
    }
    
    const calendarId = Math.random().toString(36).substr(2, 9);
    const result = parseICS(icsContent, calendarId);
    
    const newCalendar = {
      id: calendarId,
      url,
      name: result.calendarName || 'Kalender från ' + new URL(url).hostname
    };
    
    session.settings.calendarUrls.push(newCalendar);
    
    // Add to active profile
    const activeProfileId = session.settings.activeProfileId || 'default';
    session.settings.profiles = session.settings.profiles.map((p: any) => {
      if (p.id === activeProfileId) {
        return { ...p, calendarIds: [...(p.calendarIds || []), calendarId] };
      }
      return p;
    });
    
    // Add events
    result.events.forEach((e: any) => {
      session.events.push({
        ...e, 
        calendarId,
        start: e.start.toISOString(),
        end: e.end.toISOString(),
        id: e.id || Math.random().toString(36).substr(2, 9)
      });
    });
    
    // Reset reload timestamp to force fresh load next time
    session.lastEventReload = 0;
    
    await saveSessionData(session);
    
    return c.html(`
      <div class="p-4 bg-green-100 text-green-700 rounded mb-2">
        ✅ Kalender tillagd: ${newCalendar.name} (${result.events.length} händelser)
      </div>
      <script>
        (function() {
          var input = document.getElementById('calendar-url-input');
          if (input) input.value = '';
        })();
      </script>
    `);
  } catch (error: any) {
    return c.html(`<div class="p-4 bg-red-100 text-red-700 rounded">Fel: ${error.message}</div>`);
  }
});

/**
 * Add calendar from uploaded file
 */
calendar.post('/calendar/add-file', async (c) => {
  const session = await getSession(c);
  if (!session) return c.text('');
  
  try {
    const body = await c.req.parseBody();
    const file = body.file as File;
    
    if (!file) {
      return c.html(`<div class="p-4 bg-red-100 text-red-700 rounded">Ingen fil vald</div>`);
    }
    
    const icsContent = await file.text();
    const calendarId = Math.random().toString(36).substr(2, 9);
    const result = parseICS(icsContent, calendarId);
    
    const newCalendar = {
      id: calendarId,
      url: file.name,
      name: result.calendarName || file.name.replace('.ics', '')
    };
    
    session.settings.calendarUrls.push(newCalendar);
    
    // Add to active profile
    const activeProfileId = session.settings.activeProfileId || 'default';
    session.settings.profiles = session.settings.profiles.map((p: any) => {
      if (p.id === activeProfileId) {
        return { ...p, calendarIds: [...(p.calendarIds || []), calendarId] };
      }
      return p;
    });
    
    // Add events
    result.events.forEach((e: any) => {
      session.events.push({
        ...e, 
        calendarId,
        start: e.start.toISOString(),
        end: e.end.toISOString(),
        id: e.id || Math.random().toString(36).substr(2, 9)
      });
    });
    
    await saveSessionData(session);
    
    return c.html(`
      <div class="p-4 bg-green-100 text-green-700 rounded mb-2">
        ✅ Kalender uppladdad: ${newCalendar.name} (${result.events.length} händelser)
      </div>
      <script>
        (function() {
          var input = document.getElementById('calendar-file-input');
          if (input) input.value = '';
        })();
      </script>
    `);
  } catch (error: any) {
    return c.html(`<div class="p-4 bg-red-100 text-red-700 rounded">Fel: ${error.message}</div>`);
  }
});

/**
 * Delete calendar
 */
calendar.delete('/calendar/:id', async (c) => {
  const session = await getSession(c);
  if (!session) return c.text('');
  
  const calendarId = c.req.param('id');
  
  // Remove calendar
  session.settings.calendarUrls = session.settings.calendarUrls.filter((cal: any) => cal.id !== calendarId);
  
  // Remove events from this calendar
  session.events = session.events.filter((e: any) => e.calendarId !== calendarId);
  
  // Remove from all profiles
  session.settings.profiles = session.settings.profiles.map((p: any) => ({
    ...p,
    calendarIds: (p.calendarIds || []).filter((id: string) => id !== calendarId)
  }));
  
  // Reset reload timestamp
  session.lastEventReload = 0;
  
  await saveSessionData(session);
  return c.text('');
});

// ==================== EVENT OPERATIONS ====================

/**
 * Delete single event
 */
calendar.delete('/event/:id', async (c) => {
  const session = await getSession(c);
  if (!session) return c.text('');
  
  const eventId = c.req.param('id');
  
  // Find event and add to hidden events
  const event = session.events.find((e: any) => e.id === eventId);
  if (event) {
    const eventKey = `${event.calendarId}_${event.summary}_${event.start}`;
    if (!session.hiddenEvents) session.hiddenEvents = [];
    session.hiddenEvents.push(eventKey);
  }
  
  // Remove from events list
  session.events = session.events.filter((e: any) => e.id !== eventId);
  
  await saveSessionData(session);
  return c.text('');
});

/**
 * Restore hidden event
 */
calendar.post('/event/restore', async (c) => {
  const session = await getSession(c);
  if (!session) return c.text('');
  
  const body = await c.req.parseBody();
  const eventKey = body.key as string;
  
  session.hiddenEvents = (session.hiddenEvents || []).filter((k: string) => k !== eventKey);
  
  // Reset reload timestamp to force fresh load
  session.lastEventReload = 0;
  
  await saveSessionData(session);
  return c.text('');
});

/**
 * Restore all hidden events
 */
calendar.post('/event/restore-all', async (c) => {
  const session = await getSession(c);
  if (!session) return c.text('');
  
  session.hiddenEvents = [];
  
  // Reset reload timestamp to force fresh load
  session.lastEventReload = 0;
  
  await saveSessionData(session);
  return c.html('');
});

export default calendar;
