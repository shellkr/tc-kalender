// routes/calendar.ts - Calendar with smart background refresh
// FIXED: Background check preserves editMode, skipCheck after manual refresh,
//        removed events properly cleared, stale hiddenEvents cleaned up.

import { Hono } from 'hono';
import { getSession, saveSessionData, forceReloadEvents, checkCalendarsInBackground } from '../utils/auth';
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
  const session = await getSession(c, true);
  if (!session) return c.redirect('/login');
  return c.html(renderCalendarView(session));
});

/**
 * List view of calendar events
 */
calendar.get('/view/calendar/list', async (c) => {
  const session = await getSession(c, true);
  if (!session) return c.redirect('/login');

  if (!session.holidays || Object.keys(session.holidays).length === 0) {
    const currentYear = new Date().getFullYear();
    session.holidays = await fetchSwedishHolidays(currentYear);
  }

  const dateParam = c.req.query('date');
  const startDate = dateParam || new Date().toISOString().split('T')[0];
  const editModeParam = c.req.query('editMode');
  const isEditMode = editModeParam === 'true';
  const skipCheck = c.req.query('skipCheck') === 'true';

  return c.html(renderListView(session, startDate, isEditMode, skipCheck));
});

/**
 * Month view of calendar events
 */
calendar.get('/view/calendar/month', async (c) => {
  const session = await getSession(c, true);
  if (!session) return c.redirect('/login');

  if (!session.holidays || Object.keys(session.holidays).length === 0) {
    const currentYear = new Date().getFullYear();
    session.holidays = await fetchSwedishHolidays(currentYear);
  }

  const offsetParam = c.req.query('offset');
  const offset = offsetParam ? parseInt(offsetParam, 10) : 0;
  const skipCheck = c.req.query('skipCheck') === 'true';

  return c.html(renderMonthView(session, offset, skipCheck));
});

/**
 * Print view for calendar
 */
calendar.get('/view/calendar/print', async (c) => {
  const session = await getSession(c, true);
  if (!session) return c.redirect('/login');

  if (!session.holidays || Object.keys(session.holidays).length === 0) {
    const currentYear = new Date().getFullYear();
    session.holidays = await fetchSwedishHolidays(currentYear);
  }

  const startDate = c.req.query('date');
  return c.html(renderPrintView(session, startDate));
});

// ==================== BACKGROUND CHECK ====================

/**
 * Background calendar check endpoint (HTMX version).
 * Accepts `editMode` so the reload URL preserves it when changes are found.
 * FIXED: editMode is passed through so user is not kicked out of edit mode on
 *        a background refresh.
 */
calendar.get('/calendar/background-check', async (c) => {
  const session = await getSession(c, true);
  if (!session) return c.html('');

  if (!session.settings?.calendarUrls?.length) {
    return c.html('');
  }

  const currentView = c.req.query('currentView') || 'list';
  const date = c.req.query('date') || new Date().toISOString().split('T')[0];
  const offset = c.req.query('offset') || '0';
  // FIX: receive editMode so we can preserve it in the reload URL
  const editMode = c.req.query('editMode') === 'true';

  try {
    const result = await checkCalendarsInBackground(
      session.settings.calendarUrls,
      session.calendarHashes || {},
      session.hiddenEvents || []
    );

    if (result.changed) {
      session.events = result.events;
      session.calendarHashes = result.hashes;
      session.lastEventReload = Date.now();

      // FIX: clean up stale hiddenEvents entries whose source events are gone
      if (result.sourceKeys && result.sourceKeys.length > 0) {
        const sourceKeySet = new Set(result.sourceKeys);
        session.hiddenEvents = (session.hiddenEvents || []).filter(
          (k: string) => sourceKeySet.has(k)
        );
      }

      await saveSessionData(session);

      console.log(
        `✓ Background reload: ${result.events.length} events from ` +
        `${session.settings.calendarUrls.length} calendar(s)`
      );

      // FIX: preserve editMode and use skipCheck=true to prevent re-checking
      let viewUrl: string;
      if (currentView === 'month') {
        viewUrl = `/view/calendar/month?offset=${offset}&skipCheck=true`;
      } else {
        viewUrl = `/view/calendar/list?date=${date}&skipCheck=true` +
                  (editMode ? '&editMode=true' : '');
      }

      return c.html(`
        <div
          hx-get="${viewUrl}"
          hx-trigger="load"
          hx-target="#calendar-content"
          hx-swap="innerHTML"
        ></div>
      `);
    }

    // No changes – just remove the spinner
    return c.html('');
  } catch (error: any) {
    console.error('Background check failed:', error);
    return c.html('');
  }
});

// ==================== MANUAL REFRESH ====================

/**
 * Manual refresh endpoint – reload all calendar events from source.
 * FIXED: passes skipCheck=true on view reload so the background check does
 *        not fire again immediately after a full refresh.
 */
calendar.post('/calendar/refresh', async (c) => {
  const session = await getSession(c, true);
  if (!session) return c.text('');

  try {
    // forceReloadEvents now also returns sourceKeys used for hiddenEvent cleanup
    await forceReloadEvents(session);

    const eventCount = session.events?.length || 0;

    // FIX: skipCheck=true so we don't immediately re-check right after refresh
    return c.html(`
      <div class="p-3 bg-green-100 text-green-700 rounded mb-2">
        ✅ Kalendrar uppdaterade! ${eventCount} händelser laddade.
      </div>
      <script>
        setTimeout(function() {
          var calendarContent = document.getElementById('calendar-content');
          if (calendarContent) {
            var dateInput = document.getElementById('date-picker');
            var currentDate = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
            htmx.ajax('GET', '/view/calendar/list?date=' + currentDate + '&skipCheck=true', {
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

// ==================== CALENDAR MANAGEMENT ====================

/**
 * Add calendar from URL
 */
calendar.post('/calendar/add-url', async (c) => {
  const session = await getSession(c, true);
  if (!session) return c.text('');

  if (!session.settings.calendarUrls) session.settings.calendarUrls = [];

  const body = await c.req.parseBody();
  const url = body.url as string;

  if (!url || !url.trim()) {
    return c.html(`<div class="p-4 bg-red-100 text-red-700 rounded">URL krävs</div>`);
  }

  try {
    let icsContent: string;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Direct fetch failed');
      icsContent = await response.text();
    } catch {
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

    const activeProfileId = session.settings.activeProfileId || 'default';
    session.settings.profiles = session.settings.profiles.map((p: any) => {
      if (p.id === activeProfileId) {
        return { ...p, calendarIds: [...(p.calendarIds || []), calendarId] };
      }
      return p;
    });

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
 * Add calendar from uploaded ICS file
 */
calendar.post('/calendar/add-file', async (c) => {
  const session = await getSession(c, true);
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

    const activeProfileId = session.settings.activeProfileId || 'default';
    session.settings.profiles = session.settings.profiles.map((p: any) => {
      if (p.id === activeProfileId) {
        return { ...p, calendarIds: [...(p.calendarIds || []), calendarId] };
      }
      return p;
    });

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
 * Delete a calendar and all its events
 */
calendar.delete('/calendar/:id', async (c) => {
  const session = await getSession(c, true);
  if (!session) return c.text('');

  const calendarId = c.req.param('id');

  session.settings.calendarUrls = session.settings.calendarUrls.filter(
    (cal: any) => cal.id !== calendarId
  );
  session.events = session.events.filter((e: any) => e.calendarId !== calendarId);
  session.hiddenEvents = (session.hiddenEvents || []).filter(
    (k: string) => !k.startsWith(calendarId + '_')
  );
  session.settings.profiles = session.settings.profiles.map((p: any) => ({
    ...p,
    calendarIds: (p.calendarIds || []).filter((id: string) => id !== calendarId)
  }));

  await saveSessionData(session);
  return c.text('');
});

// ==================== EVENT OPERATIONS ====================

/**
 * Delete a single event (soft-delete via hiddenEvents)
 */
calendar.delete('/event/:id', async (c) => {
  const session = await getSession(c, true);
  if (!session) return c.text('');

  const eventId = c.req.param('id');
  const event = session.events.find((e: any) => e.id === eventId);

  if (event) {
    const eventKey = `${event.calendarId}_${event.summary}_${event.start}`;
    if (!session.hiddenEvents) session.hiddenEvents = [];
    session.hiddenEvents.push(eventKey);
  }

  session.events = session.events.filter((e: any) => e.id !== eventId);
  await saveSessionData(session);
  return c.text('');
});

/**
 * Batch-delete events (soft-delete via hiddenEvents)
 */
calendar.post('/events/delete-batch', async (c) => {
  const session = await getSession(c, true);
  if (!session) return c.text('');

  const body = await c.req.parseBody();
  const eventIds = JSON.parse(body.eventIds as string);

  eventIds.forEach((eventId: string) => {
    const event = session.events.find((e: any) => e.id === eventId);
    if (event) {
      const eventKey = `${event.calendarId}_${event.summary}_${event.start}`;
      if (!session.hiddenEvents) session.hiddenEvents = [];
      session.hiddenEvents.push(eventKey);
    }
  });

  session.events = session.events.filter((e: any) => !eventIds.includes(e.id));
  await saveSessionData(session);
  return c.text('OK');
});

/**
 * Restore a single hidden event
 */
calendar.post('/event/restore', async (c) => {
  const session = await getSession(c, true);
  if (!session) return c.text('');

  const body = await c.req.parseBody();
  const eventKey = body.key as string;

  session.hiddenEvents = (session.hiddenEvents || []).filter((k: string) => k !== eventKey);
  await saveSessionData(session);
  return c.text('');
});

/**
 * Restore all hidden events
 */
calendar.post('/event/restore-all', async (c) => {
  const session = await getSession(c, true);
  if (!session) return c.text('');

  session.hiddenEvents = [];
  await saveSessionData(session);
  return c.html('');
});

export default calendar;
