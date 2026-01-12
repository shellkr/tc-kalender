// server.ts - Main server file with Hono and HTMX
import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { getCookie, setCookie } from 'hono/cookie';
import { randomBytes } from 'crypto';
import { renderCalendarView } from './views/calendar';
import { renderListView } from './views/listview';
import { renderMonthView } from './views/monthview';
import { renderSettingsView } from './views/settings';
import { renderPrintView } from './views/printview';
import { renderConvertView, convertCsvToIcs, renderConversionResult } from './views/convert';
import { 
  hashPassword, 
  hashUsername, 
  encrypt, 
  decrypt, 
  parseICS, 
  defaultSettings,
  fetchSwedishHolidays
} from './utils/helpers';

import { 
  initStorage, 
  initSessionStorage, 
  loadUserSettings, 
  saveUserSettings,
  saveSession as saveSessionToFile,
  loadSession as loadSessionFromFile,
  deleteSession as deleteSessionFromFile,
  cleanupOldSessions
} from './utils/storage';

// Initialize storage on startup
await initStorage();
await initSessionStorage();

// Run session cleanup on startup and every 24 hours
cleanupOldSessions();
setInterval(cleanupOldSessions, 24 * 60 * 60 * 1000);

const app = new Hono();

// In-memory storage
const sessions = new Map<string, any>();
const userStorage = new Map<string, string>();

// Utility functions
function generateSessionId(): string {
  return randomBytes(32).toString('hex');
}

async function getSession(c: any) {
  const sessionId = getCookie(c, 'session_id');
  if (!sessionId) return null;
  
  const session = await loadSessionFromFile(sessionId);
  return session || null;
}

async function saveSession(session: any) {
  if (session?.userHash && session?.password && session?.sessionId) {
    // ✅ FIX: Save the complete data structure
    const userData = {
      settings: session.settings,
      events: session.events || [],
      hiddenEvents: session.hiddenEvents || []
    };
    
    const encrypted = encrypt(userData, session.password);
    await saveUserSettings(session.userHash, encrypted);
    
    // Also save session file for quick access
    await saveSessionToFile(session.sessionId, session);
    
    console.log(`✅ Session saved for user: ${session.username} with ${session.events?.length || 0} events`);
  }
}

// HTML rendering
function renderLayout(content: string, isDarkMode = false) {
  return `<!DOCTYPE html>
<html lang="sv" class="${isDarkMode ? 'dark' : ''}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TimeCare Kalender App</title>
  <link rel="icon" type="image/x-icon" href="/favicon.png">
  <link rel="shortcut icon" href="/favicon.png">
  <script src="https://unpkg.com/htmx.org@1.9.10"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = { darkMode: 'class' }
  </script>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .animate-spin { animation: spin 1s linear infinite; }
    .holiday-text { color: #dc2626 !important; font-weight: bold; }
  </style>
</head>
<body class="min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}">
  ${content}
</body>
</html>`;
}

function renderLoginPage(isDarkMode: boolean, error?: string) {
  return renderLayout(`
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="absolute top-4 right-4">
        <button 
          hx-post="/toggle-dark-mode-anon" 
          hx-vals='{"isDark": "${!isDarkMode}"}'
          hx-target="body"
          hx-swap="outerHTML"
          class="p-2 rounded-lg ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}"
        >
          ${isDarkMode ? '☀️' : '🌙'}
        </button>
      </div>

      <div class="w-full max-w-md p-8 rounded-lg shadow-xl ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white'}">
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full mb-4">
            <span class="text-3xl">👤</span>
          </div>
          <h1 class="text-3xl font-bold mb-2">Kalendervyn</h1>
          <p class="${isDarkMode ? 'text-gray-400' : 'text-gray-600'}">Logga in för att synka mellan enheter</p>
        </div>

        ${error ? `<div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">${error}</div>` : ''}

        <form hx-post="/login" hx-target="body" hx-swap="outerHTML" class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Användarnamn</label>
            <input type="text" name="username" required class="w-full px-4 py-2 border rounded-lg ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}" placeholder="ditt-användarnamn" />
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Lösenord</label>
            <input type="password" name="password" required class="w-full px-4 py-2 border rounded-lg ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}" placeholder="ditt-lösenord" />
          </div>
          <button type="submit" class="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            🔑 Logga in
          </button>
        </form>
        
        <div class="mt-6 pt-6 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} text-center text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}">
          <p>Inget konto? Ett konto skapas automatiskt.</p>
        </div>
      </div>
    </div>
  `, isDarkMode);
}

function renderHeader(session: any) {
  const isDarkMode = session.settings?.darkMode || false;
  const profiles = session.settings?.profiles || [{ id: 'default', name: 'Standard' }];
  const activeProfileId = session.settings?.activeProfileId || 'default';

  return `
    <header class="sticky top-0 z-50 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} border-b shadow-sm">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between h-16">
          <div class="flex items-center gap-3">
            <button hx-get="/menu" hx-target="#menu-container" hx-swap="innerHTML" class="p-2 rounded-lg ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}">☰</button>
            <div class="flex items-center gap-2">
              <span class="text-2xl">📅</span>
              <h1 class="text-xl font-bold">Kalendervyn</h1>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <select 
              name="profile" 
              hx-post="/switch-profile" 
              hx-target="body" 
              hx-swap="outerHTML"
              class="px-4 py-2 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}"
            >
              ${profiles.map((p: any) => `<option value="${p.id}" ${p.id === activeProfileId ? 'selected' : ''}>${p.name}</option>`).join('')}
            </select>
            <button 
              hx-post="/toggle-dark-mode" 
              hx-target="body" 
              hx-swap="outerHTML"
              class="p-2 rounded-lg ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}"
            >
              ${isDarkMode ? '☀️' : '🌙'}
            </button>
            <button hx-post="/logout" hx-target="body" hx-swap="outerHTML" class="p-2 rounded-lg ${isDarkMode ? 'text-red-400 hover:bg-gray-700' : 'text-red-600 hover:bg-gray-100'}" title="Inloggad som ${session.username}">👤</button>
          </div>
        </div>
      </div>
    </header>
    <div id="menu-container"></div>
  `;
}

// Routes
app.use('/static/*', serveStatic({ root: './public' }));
app.get('/favicon.png', serveStatic({ path: './public/favicon.png' }));

app.get('/', async (c) => {
  const session = await getSession(c);
  if (!session) return c.html(renderLoginPage(false));

  const isDarkMode = session.settings?.darkMode || false;
  const content = `
    ${renderHeader(session)}
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div id="main-content" hx-get="/view/calendar" hx-trigger="load" hx-swap="innerHTML">
        <div class="text-center py-12">Laddar...</div>
      </div>
    </main>
  `;
  return c.html(renderLayout(content, isDarkMode));
});

app.post('/login', async (c) => {
  const body = await c.req.parseBody();
  const username = body.username as string;
  const password = body.password as string;

  if (!username || !password) {
    return c.html(renderLoginPage(false, 'Användarnamn och lösenord krävs'));
  }

  const userHash = hashUsername(username);
  const existingData = await loadUserSettings(userHash);  // Changed from Map.get

  let settings, events, hiddenEvents;
  if (existingData) {
    try {
      const decryptedData = decrypt(existingData, password);
      
      // ✅ FIX: Load the complete structure
      if (decryptedData.settings) {
        // New format with separate settings and events
        settings = decryptedData.settings;
        events = decryptedData.events || [];
        hiddenEvents = decryptedData.hiddenEvents || [];
      } else {
        // Old format - just settings
        settings = decryptedData;
        events = [];
        hiddenEvents = [];
      }
    } catch {
      return c.html(renderLoginPage(false, 'Fel lösenord'));
    }
  } else {
    settings = defaultSettings;
    events = [];
    hiddenEvents = [];
  }
  
  const sessionId = generateSessionId();
  
  // Fetch holidays for current year and next year
  const currentYear = new Date().getFullYear();
  const holidays = await fetchSwedishHolidays(currentYear);
  const nextYearHolidays = await fetchSwedishHolidays(currentYear + 1);
  const allHolidays = { ...holidays, ...nextYearHolidays };
  
  const session = { 
    sessionId,  // Add sessionId to session object
    username, 
    userHash, 
    password, 
    settings, 
    events: [], 
    hiddenEvents: [],
    holidays: allHolidays
  };
  
  await saveSessionToFile(sessionId, session);  // Changed from Map.set

  setCookie(c, 'session_id', sessionId, { 
    httpOnly: true, 
    secure: false, 
    sameSite: 'Lax', 
    maxAge: 60 * 60 * 24 * 7 
  });
  
  return c.redirect('/');
});

async function fetchICS(url: string, name: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('direct failed');
    return await res.text();
  } catch {
    const proxy = `https://corsproxy.io/?${encodeURIComponent(url)}`;
    const res = await fetch(proxy);
    if (!res.ok) throw new Error(`proxy failed for ${name}`);
    return await res.text();
  }
}

app.post('/logout', async (c) => {
  const sessionId = getCookie(c, 'session_id');
  if (sessionId) {
    await deleteSessionFromFile(sessionId);  // Changed from Map.delete
  }
  setCookie(c, 'session_id', '', { maxAge: 0 });
  return c.html(renderLoginPage(false));
});

app.post('/toggle-dark-mode', async (c) => {
  const session = await getSession(c);
  if (!session) return c.redirect('/');
  session.settings.darkMode = !session.settings.darkMode;
  await saveSession(session);
  
  c.header('HX-Redirect', '/');
  return c.text('', 200);
});

app.post('/toggle-dark-mode-anon', async (c) => {
  const body = await c.req.parseBody();
  const isDark = body.isDark === 'true';
  return c.html(renderLoginPage(isDark));
});

app.post('/switch-profile', async (c) => {
  const session = await getSession(c);
  if (!session) return c.redirect('/');
  const body = await c.req.parseBody();
  session.settings.activeProfileId = body.profile as string;
  await saveSession(session);
  return c.redirect('/');
});

app.get('/menu', async (c) => {
  const session = await getSession(c);
  if (!session) return c.text('');
  const isDarkMode = session.settings?.darkMode || false;

  return c.html(`
    <div class="fixed inset-0 bg-black bg-opacity-50 z-40" onclick="this.parentElement.innerHTML = ''"></div>
    <div class="fixed left-0 top-0 h-full w-64 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg z-50">
      <div class="p-4">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-bold">Meny</h2>
          <button onclick="document.getElementById('menu-container').innerHTML = ''" class="p-2 rounded-lg ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}">✕</button>
        </div>
        <nav class="space-y-1">
          <button 
            hx-get="/view/calendar" 
            hx-target="#main-content" 
            hx-swap="innerHTML"
            onclick="setTimeout(() => document.getElementById('menu-container').innerHTML = '', 100)" 
            class="w-full flex items-center gap-3 px-4 py-3 rounded-lg ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'} text-left"
          >
            📅 Kalendervy
          </button>
          <button 
            hx-get="/view/convert" 
            hx-target="#main-content" 
            hx-swap="innerHTML"
            onclick="setTimeout(() => document.getElementById('menu-container').innerHTML = '', 100)" 
            class="w-full flex items-center gap-3 px-4 py-3 rounded-lg ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'} text-left"
          >
            📤 CSV till ICS
          </button>
          <button 
            hx-get="/view/settings" 
            hx-target="#main-content" 
            hx-swap="innerHTML"
            onclick="setTimeout(() => document.getElementById('menu-container').innerHTML = '', 100)" 
            class="w-full flex items-center gap-3 px-4 py-3 rounded-lg ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'} text-left"
          >
            ⚙️ Inställningar
          </button>
        </nav>
      </div>
    </div>
  `);
});

app.get('/view/calendar', async (c) => {
  const session = await getSession(c);
  if (!session) return c.redirect('/');
  return c.html(renderCalendarView(session));
});

app.get('/view/calendar/list', async (c) => {
  const session = await getSession(c);
  if (!session) return c.redirect('/');
  
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

app.get('/view/calendar/month', async (c) => {
  const session = await getSession(c);
  if (!session) return c.redirect('/');
  
  // Ensure holidays are loaded
  if (!session.holidays || Object.keys(session.holidays).length === 0) {
    const currentYear = new Date().getFullYear();
    session.holidays = await fetchSwedishHolidays(currentYear);
  }
  
  const offsetParam = c.req.query('offset');
  const offset = offsetParam ? parseInt(offsetParam, 10) : 0;
  
  return c.html(renderMonthView(session, offset));
});

app.get('/view/settings', async (c) => {
  const session = await getSession(c);
  if (!session) return c.redirect('/');
  return c.html(renderSettingsView(session));
});

app.get('/view/calendar/print', async (c) => {
  const session = await getSession(c);
  if (!session) return c.redirect('/');
  
  // Ensure holidays are loaded
  if (!session.holidays || Object.keys(session.holidays).length === 0) {
    const currentYear = new Date().getFullYear();
    session.holidays = await fetchSwedishHolidays(currentYear);
  }
  
  const startDate = c.req.query('date');
  return c.html(renderPrintView(session, startDate));
});

app.get('/view/convert', async (c) => {
  const session = await getSession(c);
  if (!session) return c.redirect('/');
  return c.html(renderConvertView(session));
});

app.post('/convert/csv', async (c) => {
  const session = await getSession(c);
  if (!session) return c.redirect('/');

  try {
    const body = await c.req.parseBody();
    const file = body.file as File;
    const csvContent = await file.text();
    const result = convertCsvToIcs(csvContent);
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `arbetsschema_${timestamp}.ics`;
    return c.html(renderConversionResult(result.content, result.stats, session.settings?.darkMode || false, filename));
  } catch (error: any) {
    return c.html(`<div class="p-4 bg-red-100 text-red-700 rounded">Fel: ${error.message}</div>`);
  }
});

app.post('/convert/import', async (c) => {
  const session = await getSession(c);
  if (!session) return c.redirect('/');

  try {
    const body = await c.req.parseBody();
    const icsContent = body.icsContent as string;
    const filename = body.filename as string;
    
    const calendarId = Math.random().toString(36).substr(2, 9);
    const result = parseICS(icsContent, calendarId);
    
    const newCalendar = { id: calendarId, url: filename, name: 'Konverterad från CSV' };
    session.settings.calendarUrls.push(newCalendar);
    
    result.events.forEach((e: any) => {
      session.events.push({
        ...e, calendarId,
        start: e.start.toISOString(),
        end: e.end.toISOString(),
        id: e.id || Math.random().toString(36).substr(2, 9)
      });
    });
    
    await saveSession(session);
    
    return c.html(`
      <div class="p-4 bg-green-100 text-green-700 rounded mb-2">
        ✅ ${result.events.length} händelser importerade till kalendern!
      </div>
      <script>setTimeout(() => { window.location.href = '/'; }, 1500);</script>
    `);
  } catch (error: any) {
    return c.html(`<div class="p-4 bg-red-100 text-red-700 rounded">Fel: ${error.message}</div>`);
  }
});

app.post('/calendar/add-url', async (c) => {
  const session = await getSession(c);
  if (!session) return c.text('');
  
  const body = await c.req.parseBody();
  const url = body.url as string;
  
  if (!url || !url.trim()) {
    return c.html(`<div class="p-4 bg-red-100 text-red-700 rounded">URL krävs</div>`);
  }
  
  try {
    let icsContent;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Direct fetch failed');
      icsContent = await response.text();
    } catch (directError) {
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
    
    const activeProfileId = session.settings.activeProfileId || 'default';
    session.settings.profiles = session.settings.profiles.map((p: any) => {
      if (p.id === activeProfileId) {
        return { ...p, calendarIds: [...(p.calendarIds || []), calendarId] };
      }
      return p;
    });
    
    result.events.forEach((e: any) => {
      session.events.push({
        ...e, calendarId,
        start: e.start.toISOString(),
        end: e.end.toISOString(),
        id: e.id || Math.random().toString(36).substr(2, 9)
      });
    });
    
    await saveSession(session);
    
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

app.post('/calendar/add-file', async (c) => {
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
    
    const activeProfileId = session.settings.activeProfileId || 'default';
    session.settings.profiles = session.settings.profiles.map((p: any) => {
      if (p.id === activeProfileId) {
        return { ...p, calendarIds: [...(p.calendarIds || []), calendarId] };
      }
      return p;
    });
    
    result.events.forEach((e: any) => {
      session.events.push({
        ...e, calendarId,
        start: e.start.toISOString(),
        end: e.end.toISOString(),
        id: e.id || Math.random().toString(36).substr(2, 9)
      });
    });
    
    await saveSession(session);
    
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

app.delete('/calendar/:id', async (c) => {
  const session = await getSession(c);
  if (!session) return c.text('');
  
  const calendarId = c.req.param('id');
  session.settings.calendarUrls = session.settings.calendarUrls.filter((cal: any) => cal.id !== calendarId);
  session.events = session.events.filter((e: any) => e.calendarId !== calendarId);
  await saveSession(session);
  return c.text('');
});

app.post('/keyword/add', async (c) => {
  const session = await getSession(c);
  if (!session) return c.text('');
  
  const body = await c.req.parseBody();
  
  // Split keywords by comma and clean them up
  const keywordsString = body.keyword as string;
  const keywords = keywordsString
    .split(',')
    .map(k => k.trim().toLowerCase())
    .filter(k => k.length > 0);
  
  const newRule = {
    id: Math.random().toString(36).substr(2, 9),
    name: body.name as string,
    keywords: keywords,
    color: body.color as string,
    textColor: body.textColor as string
  };
  
  session.settings.keywordRules.push(newRule);
  await saveSession(session);
  
  const isDarkMode = session.settings.darkMode || false;
  
  return c.html(`
    <div class="border rounded-lg p-3 ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <div 
            class="w-6 h-6 rounded border flex items-center justify-center text-xs font-bold flex-shrink-0" 
            style="background-color: ${newRule.color}; color: ${newRule.textColor}"
          >
            A
          </div>
          <div class="min-w-0 flex-1">
            <div class="font-medium text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}">${newRule.name}</div>
            <div class="text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}">${newRule.keywords.join(', ')}</div>
          </div>
        </div>
        <div class="flex gap-1 flex-shrink-0">
          <button
            hx-get="/keyword/${newRule.id}/edit"
            hx-target="closest div"
            hx-swap="outerHTML"
            class="p-2 text-blue-600 hover:bg-blue-100 rounded transition-colors"
            title="Redigera regel"
          >
            ✏️
          </button>
          <button 
            hx-delete="/keyword/${newRule.id}" 
            hx-confirm="Är du säker?" 
            hx-target="closest div" 
            hx-swap="outerHTML swap:0.5s" 
            class="p-2 text-red-600 hover:bg-red-100 rounded transition-colors"
            title="Ta bort regel"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
    <script>
      (function() {
        const calendarContent = document.getElementById('calendar-content');
        if (calendarContent) {
          const dateInput = document.getElementById('date-picker');
          const currentDate = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
          const editMode = document.querySelector('.event-checkbox') !== null;
          
          setTimeout(function() {
            htmx.ajax('GET', '/view/calendar/list?date=' + currentDate + '&editMode=' + editMode, {
              target: '#calendar-content',
              swap: 'innerHTML'
            });
          }, 100);
        }
      })();
    </script>
  `);
});

app.delete('/keyword/:id', async (c) => {
  const session = await getSession(c);
  if (!session) return c.text('');
  const ruleId = c.req.param('id');
  session.settings.keywordRules = session.settings.keywordRules.filter((r: any) => r.id !== ruleId);
  await saveSession(session);
  return c.text('');
});

app.get('/keyword/:id/edit', async (c) => {
  const session = await getSession(c);
  if (!session) return c.text('');
  
  const ruleId = c.req.param('id');
  const rule = session.settings.keywordRules.find((r: any) => r.id === ruleId);
  
  if (!rule) return c.text('');
  
  const isDarkMode = session.settings.darkMode || false;
  return c.html(renderKeywordRuleEditing(rule, isDarkMode));
});

app.get('/keyword/:id/cancel-edit', async (c) => {
  const session = await getSession(c);
  if (!session) return c.text('');
  
  const ruleId = c.req.param('id');
  const rule = session.settings.keywordRules.find((r: any) => r.id === ruleId);
  
  if (!rule) return c.text('');
  
  const isDarkMode = session.settings.darkMode || false;
  return c.html(renderKeywordRuleDisplay(rule, isDarkMode));
});

// Add this debug route temporarily
app.get('/debug/session', (c) => {
  const session = getSession(c);
  if (!session) return c.text('No session');

  return c.json({
    username: session.username,
    eventsCount: session.events?.length || 0,
    calendarsCount: session.settings?.calendarUrls?.length || 0,
    calendarUrls: session.settings?.calendarUrls?.map((cal: any) => ({
      id: cal.id,
      name: cal.name,
      url: cal.url.substring(0, 50) + '...'
    })) || [],
    activeProfileId: session.settings?.activeProfileId,
    profileCalendarIds: session.settings?.profiles?.find((p: any) => p.id === session.settings?.activeProfileId)?.calendarIds || []
  });
});

app.post('/keyword/:id/edit', async (c) => {
  const session = await getSession(c);
  if (!session) return c.text('');
  
  const ruleId = c.req.param('id');
  const body = await c.req.parseBody();
  
  const updatedRule = {
    id: ruleId,
    name: body.name as string,
    keywords: (body.keywords as string).split(',').map(k => k.trim().toLowerCase()).filter(k => k.length > 0),
    color: body.color as string,
    textColor: body.textColor as string
  };
  
  session.settings.keywordRules = session.settings.keywordRules.map((r: any) => 
    r.id === ruleId ? updatedRule : r
  );
  
  await saveSession(session);
  
  const isDarkMode = session.settings.darkMode || false;
  return c.html(renderKeywordRuleDisplay(updatedRule, isDarkMode));
});

function renderKeywordRuleDisplay(rule: any, isDarkMode: boolean) {
  return `
    <div class="border rounded-lg p-3 ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <div
            class="w-6 h-6 rounded border flex items-center justify-center text-xs font-bold flex-shrink-0"
            style="background-color: ${rule.color}; color: ${rule.textColor || '#ffffff'}"
          >
            A
          </div>
          <div class="min-w-0 flex-1">
            <div class="font-medium text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}">${rule.name}</div>
            <div class="text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}">${rule.keywords.join(', ')}</div>
          </div>
        </div>
        <div class="flex gap-1 flex-shrink-0">
          <button
            hx-get="/keyword/${rule.id}/edit"
            hx-target="closest div"
            hx-swap="outerHTML"
            class="p-2 text-blue-600 hover:bg-blue-100 rounded transition-colors"
            title="Redigera regel"
          >
            ✏️
          </button>
          <button
            hx-delete="/keyword/${rule.id}"
            hx-confirm="Är du säker?"
            hx-target="closest div"
            hx-swap="outerHTML swap:0.5s"
            class="p-2 text-red-600 hover:bg-red-100 rounded transition-colors"
            title="Ta bort regel"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderKeywordRuleEditing(rule: any, isDarkMode: boolean) {
  return `
    <div class="border rounded-lg p-3 ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'}">
      <form 
        hx-post="/keyword/${rule.id}/edit" 
        hx-target="closest div" 
        hx-swap="outerHTML"
        class="space-y-3"
      >
        <input
          type="text"
          name="name"
          value="${rule.name}"
          placeholder="Regelnamn"
          required
          class="w-full px-3 py-2 border rounded text-sm ${isDarkMode ? 'bg-gray-600 border-gray-500 text-white' : 'border-gray-300'}"
        />
        <input
          type="text"
          name="keywords"
          value="${rule.keywords.join(', ')}"
          placeholder="Nyckelord (kommaseparerade)"
          required
          class="w-full px-3 py-2 border rounded text-sm ${isDarkMode ? 'bg-gray-600 border-gray-500 text-white' : 'border-gray-300'}"
        />
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}">Bakgrundsfärg</label>
            <input
              type="color"
              name="color"
              value="${rule.color}"
              class="w-full h-10 rounded border"
            />
          </div>
          <div>
            <label class="block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}">Textfärg</label>
            <input
              type="color"
              name="textColor"
              value="${rule.textColor || '#ffffff'}"
              class="w-full h-10 rounded border"
            />
          </div>
        </div>
        <div>
          <label class="block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}">Förhandsgranskning</label>
          <div 
            id="preview-${rule.id}"
            class="h-10 rounded border border-gray-300 flex items-center justify-center text-xs font-medium"
            style="background-color: ${rule.color}; color: ${rule.textColor || '#ffffff'}"
          >
            ${rule.name}
          </div>
        </div>
        <div class="flex gap-2">
          <button
            type="submit"
            class="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
          >
            ✓ Spara
          </button>
          <button
            type="button"
            hx-get="/keyword/${rule.id}/cancel-edit"
            hx-target="closest div"
            hx-swap="outerHTML"
            class="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm"
          >
            ✕ Avbryt
          </button>
        </div>
      </form>
      <script>
        (function() {
          const form = document.querySelector('form[hx-post="/keyword/${rule.id}/edit"]');
          if (!form) return;
          
          const colorInput = form.querySelector('input[name="color"]');
          const textColorInput = form.querySelector('input[name="textColor"]');
          const nameInput = form.querySelector('input[name="name"]');
          const preview = document.getElementById('preview-${rule.id}');
          
          function updatePreview() {
            if (preview && colorInput && textColorInput && nameInput) {
              preview.style.backgroundColor = colorInput.value;
              preview.style.color = textColorInput.value;
              preview.textContent = nameInput.value || '${rule.name}';
            }
          }
          
          if (colorInput) colorInput.addEventListener('input', updatePreview);
          if (textColorInput) textColorInput.addEventListener('input', updatePreview);
          if (nameInput) nameInput.addEventListener('input', updatePreview);
        })();
      </script>
    </div>
  `;
}

app.post('/profile/add', async (c) => {
  const session = await getSession(c);
  if (!session) return c.text('');
  
  const body = await c.req.parseBody();
  const profileName = body.name as string;
  
  if (!profileName || !profileName.trim()) {
    return c.html(`<div class="p-3 bg-red-100 text-red-700 rounded">Profilnamn krävs</div>`);
  }
  
  const newProfile = {
    id: 'profile_' + Date.now(),
    name: profileName.trim(),
    calendarIds: []
  };
  
  session.settings.profiles.push(newProfile);
  await saveSession(session);
  
  return c.html(`
    <div class="p-3 bg-green-100 text-green-700 rounded mb-2">
      ✅ Profil "${profileName}" skapad!
    </div>
    <script>
      (function() {
        var input = document.getElementById('profile-name-input');
        if (input) input.value = '';
        setTimeout(function() {
          htmx.ajax('GET', '/view/settings', {target: '#main-content', swap: 'innerHTML'});
        }, 1000);
      })();
    </script>
  `);
});

app.delete('/profile/:id', async (c) => {
  const session = await getSession(c);
  if (!session) return c.text('');
  
  const profileId = c.req.param('id');
  session.settings.profiles = session.settings.profiles.filter((p: any) => p.id !== profileId);
  
  if (session.settings.activeProfileId === profileId) {
    session.settings.activeProfileId = session.settings.profiles[0]?.id || 'default';
  }
  
  await saveSession(session);
  return c.text('');
});

app.post('/profile/:id/toggle-calendar', async (c) => {
  const session = await getSession(c);
  if (!session) return c.text('');
  
  const profileId = c.req.param('id');
  const body = await c.req.parseBody();
  const calendarId = body.calendarId as string;
  
  session.settings.profiles = session.settings.profiles.map((p: any) => {
    if (p.id !== profileId) return p;
    const calendarIds = p.calendarIds || [];
    const hasCalendar = calendarIds.includes(calendarId);
    return { ...p, calendarIds: hasCalendar ? calendarIds.filter((id: string) => id !== calendarId) : [...calendarIds, calendarId] };
  });
  
  await saveSession(session);
  
  const profile = session.settings.profiles.find((p: any) => p.id === profileId);
  const calendar = session.settings.calendarUrls.find((c: any) => c.id === calendarId);
  const isSelected = profile?.calendarIds?.includes(calendarId);
  const isDarkMode = session.settings.darkMode || false;
  
  return c.html(`
    <label class="flex items-center gap-2 p-1.5 rounded cursor-pointer ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-100'}">
      <input type="checkbox" ${isSelected ? 'checked' : ''} hx-post="/profile/${profileId}/toggle-calendar" hx-vals='{"calendarId": "${calendarId}"}' hx-target="closest label" hx-swap="outerHTML" class="w-4 h-4 text-blue-600 rounded" />
      <span class="text-xs ${isDarkMode ? 'text-white' : 'text-gray-900'}">${calendar?.name || ''}</span>
    </label>
  `);
});

app.delete('/event/:id', async (c) => {
  const session = await getSession(c);
  if (!session) return c.text('');
  const eventId = c.req.param('id');
  session.events = session.events.filter((e: any) => e.id !== eventId);
  await saveSession(session);
  return c.text('');
});

app.post('/event/restore', async (c) => {
  const session = await getSession(c);
  if (!session) return c.text('');
  const body = await c.req.parseBody();
  const eventKey = body.key as string;
  session.hiddenEvents = (session.hiddenEvents || []).filter((k: string) => k !== eventKey);
  await saveSession(session);
  return c.text('');
});

app.post('/event/restore-all', async (c) => {
  const session = await getSession(c);
  if (!session) return c.text('');
  session.hiddenEvents = [];
  await saveSession(session);
  return c.html('');
});

app.post('/view/calendar/toggle-edit', async (c) => {
  const session = await getSession(c);
  if (!session) return c.redirect('/');
  session.isEditMode = !session.isEditMode;
  return c.html(renderListView(session));
});

app.post('/view/calendar/reset-today', async (c) => {
  const session = await getSession(c);
  if (!session) return c.redirect('/');
  session.isEditMode = false;
  return c.html(renderListView(session));
});

app.post('/events/delete-batch', async (c) => {
  const session = await getSession(c);
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
  await saveSession(session);
  return c.text('OK');
});

export default { port: 3000, fetch: app.fetch };
console.log('🚀 Server running on http://localhost:8080');
