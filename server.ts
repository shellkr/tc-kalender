import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { getCookie, setCookie } from 'hono/cookie';
import { createHash, randomBytes } from 'crypto';
import { renderCalendarView, renderListView, renderMonthView } from './views/calendar';
import { renderSettingsView } from './views/settings';
import { renderConvertView, convertCsvToIcs, renderConversionResult } from './views/convert';

const app = new Hono();

// In-memory storage
const sessions = new Map<string, any>();
const userStorage = new Map<string, string>();

// Utility functions
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

function hashUsername(username: string): string {
  return createHash('sha256').update(username.toLowerCase()).digest('hex').substring(0, 16);
}

function generateSessionId(): string {
  return randomBytes(32).toString('hex');
}

function encrypt(data: any, password: string): string {
  const json = JSON.stringify(data);
  const key = hashPassword(password);
  return Buffer.from(json + '::' + key).toString('base64');
}

function decrypt(encrypted: string, password: string): any {
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

function parseICS(icsContent: string, calendarId: string) {
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

function getSession(c: any) {
  const sessionId = getCookie(c, 'session_id');
  return sessionId ? sessions.get(sessionId) || null : null;
}

function saveSession(session: any) {
  if (session?.userHash && session?.password) {
    try {
      const encrypted = encrypt(session.settings, session.password);
      userStorage.set(session.userHash, encrypted);
    } catch (error) {
      console.error('Failed to save session:', error);
    }
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
  <script src="https://unpkg.com/htmx.org@1.9.10"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = { darkMode: 'class' };
    
    // Global function to close menu
    window.closeMenu = function() {
      const menuContainer = document.getElementById('menu-container');
      if (menuContainer) {
        menuContainer.innerHTML = '';
      }
    };
    
    // Debug HTMX
    document.addEventListener('DOMContentLoaded', function() {
      document.body.addEventListener('htmx:afterSwap', function(evt) {
        console.log('HTMX swap completed:', evt.detail);
      });
      document.body.addEventListener('htmx:responseError', function(evt) {
        console.error('HTMX error:', evt.detail);
      });
    });
  </script>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; }
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
          onclick="toggleDarkModeAnon()"
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
      </div>
    </div>
    <script>
      function toggleDarkModeAnon() {
        const html = document.documentElement;
        const isDark = html.classList.contains('dark');
        if (isDark) {
          html.classList.remove('dark');
          document.body.className = document.body.className.replace('bg-gray-900', 'bg-gray-50').replace('text-white', 'text-gray-900');
        } else {
          html.classList.add('dark');
          document.body.className = document.body.className.replace('bg-gray-50', 'bg-gray-900').replace('text-gray-900', 'text-white');
        }
      }
    </script>
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
            <button 
              hx-get="/menu" 
              hx-target="#menu-container" 
              hx-swap="innerHTML"
              class="p-2 rounded-lg ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}"
            >
              ☰
            </button>
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
            <button 
              hx-post="/logout" 
              hx-target="body" 
              hx-swap="outerHTML" 
              class="p-2 rounded-lg ${isDarkMode ? 'text-red-400 hover:bg-gray-700' : 'text-red-600 hover:bg-gray-100'}" 
              title="Inloggad som ${session.username}"
            >
              👤
            </button>
          </div>
        </div>
      </div>
    </header>
    <div id="menu-container"></div>
  `;
}

// Routes
app.use('/static/*', serveStatic({ root: './public' }));

app.get('/', (c) => {
  const session = getSession(c);
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
  const existingData = userStorage.get(userHash);

  let settings;
  if (existingData) {
    try {
      settings = decrypt(existingData, password);
    } catch {
      return c.html(renderLoginPage(false, 'Fel lösenord'));
    }
  } else {
    settings = {
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
    const encrypted = encrypt(settings, password);
    userStorage.set(userHash, encrypted);
  }

  const sessionId = generateSessionId();
  sessions.set(sessionId, { username, userHash, password, settings, events: [], hiddenEvents: [] });

  setCookie(c, 'session_id', sessionId, { httpOnly: true, secure: false, sameSite: 'Lax', maxAge: 60 * 60 * 24 * 7 });
  return c.redirect('/');
});

app.post('/logout', (c) => {
  const sessionId = getCookie(c, 'session_id');
  if (sessionId) sessions.delete(sessionId);
  setCookie(c, 'session_id', '', { maxAge: 0 });
  return c.html(renderLoginPage(false));
});

app.post('/toggle-dark-mode', (c) => {
  const session = getSession(c);
  if (!session) return c.redirect('/');
  session.settings.darkMode = !session.settings.darkMode;
  saveSession(session);
  return c.text('');
});

app.post('/profile/:id/toggle-calendar', async (c) => {
  const session = getSession(c);
  if (!session) return c.text('', 401);

  const profileId = c.req.param('id');
  const body = await c.req.parseBody();
  const calendarId = body.calendarId as string;

  const profile = session.settings.profiles.find((p: any) => p.id === profileId);
  if (!profile) return c.text('', 404);

  const index = profile.calendarIds.indexOf(calendarId);
  if (index > -1) {
    profile.calendarIds.splice(index, 1);
  } else {
    profile.calendarIds.push(calendarId);
  }

  saveSession(session);

  const isDarkMode = session.settings?.darkMode || false;
  const cal = session.settings.calendarUrls.find((c: any) => c.id === calendarId);
  const isSelected = profile.calendarIds.includes(calendarId);

  return c.html(`
    <label class="flex items-center gap-2 p-1.5 rounded cursor-pointer ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-100'}">
      <input
        type="checkbox"
        ${isSelected ? 'checked' : ''}
        hx-post="/profile/${profileId}/toggle-calendar"
        hx-vals='{"calendarId": "${calendarId}"}'
        hx-target="closest label"
        hx-swap="outerHTML"
        class="w-4 h-4 text-blue-600 rounded"
      />
      <span class="text-xs ${isDarkMode ? 'text-white' : 'text-gray-900'}">${cal?.name || 'Unknown'}</span>
    </label>
  `);
});

app.post('/switch-profile', async (c) => {
  const session = getSession(c);
  if (!session) return c.redirect('/');
  const body = await c.req.parseBody();
  session.settings.activeProfileId = body.profile as string;
  saveSession(session);
  return c.redirect('/');
});

app.get('/menu', (c) => {
  const session = getSession(c);
  if (!session) return c.text('');
  const isDarkMode = session.settings?.darkMode || false;

  return c.html(`
    <div class="fixed inset-0 bg-black bg-opacity-50 z-40" onclick="closeMenu()"></div>
    <div class="fixed left-0 top-0 h-full w-64 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg z-50">
      <div class="p-4">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-bold">Meny</h2>
          <button onclick="closeMenu()" class="p-2 rounded-lg ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}">
            ✕
          </button>
        </div>
        <nav class="space-y-1">
          <button
            hx-get="/view/calendar"
            hx-target="#main-content"
            hx-swap="innerHTML"
            onclick="closeMenu()"
            class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}"
          >
            📅 Kalendervy
          </button>
          <button
            hx-get="/view/convert"
            hx-target="#main-content"
            hx-swap="innerHTML"
            onclick="closeMenu()"
            class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}"
          >
            📤 CSV till ICS
          </button>
          <button
            hx-get="/view/settings"
            hx-target="#main-content"
            hx-swap="innerHTML"
            onclick="closeMenu()"
            class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'}"
          >
            ⚙️ Inställningar
          </button>
        </nav>
      </div>
    </div>
  `);
});

// View routes
app.get('/view/calendar', (c) => {
  const session = getSession(c);
  if (!session) {
    console.log('No session for /view/calendar');
    return c.text('Not authenticated', 401);
  }
  console.log('Rendering calendar view');
  return c.html(renderCalendarView(session));
});

app.get('/view/calendar/list', (c) => {
  const session = getSession(c);
  if (!session) return c.text('Not authenticated', 401);
  return c.html(renderListView(session));
});

app.get('/view/calendar/month', (c) => {
  const session = getSession(c);
  if (!session) return c.text('Not authenticated', 401);
  return c.html(renderMonthView(session));
});

app.get('/view/settings', (c) => {
  const session = getSession(c);
  if (!session) {
    console.log('No session for /view/settings');
    return c.text('Not authenticated', 401);
  }
  console.log('Rendering settings view');
  return c.html(renderSettingsView(session));
});

app.get('/view/convert', (c) => {
  const session = getSession(c);
  if (!session) {
    console.log('No session for /view/convert');
    return c.text('Not authenticated', 401);
  }
  console.log('Rendering convert view');
  return c.html(renderConvertView(session));
});

// Convert routes
app.post('/convert/csv', async (c) => {
  const session = getSession(c);
  if (!session) return c.text('Not authenticated', 401);

  try {
    const body = await c.req.parseBody();
    const file = body.file as File;
    const csvContent = await file.text();
    const result = convertCsvToIcs(csvContent);
    return c.html(renderConversionResult(result.content, result.stats, session.settings?.darkMode || false));
  } catch (error: any) {
    return c.html(`<div class="p-4 bg-red-100 text-red-700 rounded">Fel: ${error.message}</div>`);
  }
});

app.post('/convert/import', async (c) => {
  const session = getSession(c);
  if (!session) return c.text('Not authenticated', 401);

  try {
    const body = await c.req.parseBody();
    const icsContent = body.icsContent as string;
    const filename = body.filename as string;

    const calendarId = 'cal_' + Date.now();
    const { events, calendarName } = parseICS(icsContent, calendarId);

    session.settings.calendarUrls.push({
      id: calendarId,
      url: 'imported',
      name: calendarName || filename
    });

    session.events.push(...events);

    // Add to active profile
    const activeProfile = session.settings.profiles.find((p: any) => p.id === session.settings.activeProfileId);
    if (activeProfile && !activeProfile.calendarIds.includes(calendarId)) {
      activeProfile.calendarIds.push(calendarId);
    }

    saveSession(session);

    return c.html(renderCalendarView(session));
  } catch (error: any) {
    return c.html(`<div class="p-4 bg-red-100 text-red-700 rounded">Fel vid import: ${error.message}</div>`);
  }
});

// Calendar management routes
app.post('/calendar/add-url', async (c) => {
  const session = getSession(c);
  if (!session) return c.text('', 401);

  try {
    const body = await c.req.parseBody();
    const url = body.url as string;

    const response = await fetch(url);
    const icsContent = await response.text();

    const calendarId = 'cal_' + Date.now();
    const { events, calendarName } = parseICS(icsContent, calendarId);

    session.settings.calendarUrls.push({
      id: calendarId,
      url: url,
      name: calendarName || 'Kalender från URL'
    });

    session.events.push(...events);
    saveSession(session);

    const isDarkMode = session.settings?.darkMode || false;
    const cal = session.settings.calendarUrls[session.settings.calendarUrls.length - 1];

    return c.html(`
      <div class="flex items-start gap-2 p-3 rounded border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}">
        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}">${cal.name}</div>
          <div class="text-xs break-all ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}">${cal.url}</div>
        </div>
        <button
          hx-delete="/calendar/${cal.id}"
          hx-confirm="Är du säker?"
          hx-target="closest div"
          hx-swap="outerHTML swap:0.5s"
          class="p-2 text-red-600 hover:bg-red-100 rounded"
        >
          🗑️
        </button>
      </div>
    `);
  } catch (error: any) {
    return c.html(`<div class="p-3 bg-red-100 text-red-700 rounded text-sm">Fel: ${error.message}</div>`);
  }
});

app.post('/calendar/add-file', async (c) => {
  const session = getSession(c);
  if (!session) return c.text('', 401);

  try {
    const body = await c.req.parseBody();
    const file = body.file as File;
    const icsContent = await file.text();

    const calendarId = 'cal_' + Date.now();
    const { events, calendarName } = parseICS(icsContent, calendarId);

    session.settings.calendarUrls.push({
      id: calendarId,
      url: file.name,
      name: calendarName || file.name
    });

    session.events.push(...events);
    saveSession(session);

    const isDarkMode = session.settings?.darkMode || false;
    const cal = session.settings.calendarUrls[session.settings.calendarUrls.length - 1];

    return c.html(`
      <div class="flex items-start gap-2 p-3 rounded border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}">
        <div class="flex-1 min-w-0">
          <div class="font-medium text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}">${cal.name}</div>
          <div class="text-xs break-all ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}">${cal.url}</div>
        </div>
        <button
          hx-delete="/calendar/${cal.id}"
          hx-confirm="Är du säker?"
          hx-target="closest div"
          hx-swap="outerHTML swap:0.5s"
          class="p-2 text-red-600 hover:bg-red-100 rounded"
        >
          🗑️
        </button>
      </div>
    `);
  } catch (error: any) {
    return c.html(`<div class="p-3 bg-red-100 text-red-700 rounded text-sm">Fel: ${error.message}</div>`);
  }
});

app.delete('/calendar/:id', (c) => {
  const session = getSession(c);
  if (!session) return c.text('', 401);

  const calendarId = c.req.param('id');
  session.settings.calendarUrls = session.settings.calendarUrls.filter((cal: any) => cal.id !== calendarId);
  session.events = session.events.filter((e: any) => e.calendarId !== calendarId);

  // Remove from all profiles
  session.settings.profiles.forEach((profile: any) => {
    profile.calendarIds = profile.calendarIds.filter((id: string) => id !== calendarId);
  });

  saveSession(session);
  return c.text('');
});

// Keyword management routes
app.post('/keyword/add', async (c) => {
  const session = getSession(c);
  if (!session) return c.text('', 401);

  const body = await c.req.parseBody();
  const newRule = {
    id: 'rule_' + Date.now(),
    name: body.name as string,
    keywords: [(body.keyword as string).toLowerCase()],
    color: body.color as string,
    textColor: body.textColor as string
  };

  session.settings.keywordRules.push(newRule);
  saveSession(session);

  const isDarkMode = session.settings?.darkMode || false;

  return c.html(`
    <div class="border rounded-lg p-3 ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <div
            class="w-6 h-6 rounded border flex items-center justify-center text-xs font-bold"
            style="background-color: ${newRule.color}; color: ${newRule.textColor}"
          >
            A
          </div>
          <div class="min-w-0 flex-1">
            <div class="font-medium text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}">${newRule.name}</div>
            <div class="text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}">${newRule.keywords.join(', ')}</div>
          </div>
        </div>
        <button
          hx-delete="/keyword/${newRule.id}"
          hx-confirm="Är du säker?"
          hx-target="closest div"
          hx-swap="outerHTML swap:0.5s"
          class="p-2 text-red-600 hover:bg-red-100 rounded"
        >
          🗑️
        </button>
      </div>
    </div>
  `);
});

app.delete('/keyword/:id', (c) => {
  const session = getSession(c);
  if (!session) return c.text('', 401);

  const ruleId = c.req.param('id');
  session.settings.keywordRules = session.settings.keywordRules.filter((rule: any) => rule.id !== ruleId);
  saveSession(session);
  return c.text('');
});

// Event routes
app.delete('/event/:id', (c) => {
  const session = getSession(c);
  if (!session) return c.text('', 401);
  
  const eventId = c.req.param('id');
  session.events = session.events.filter((e: any) => e.id !== eventId);
  saveSession(session);
  return c.text('');
});

// Profile routes
app.post('/profile/add', async (c) => {
  const session = getSession(c);
  if (!session) return c.text('', 401);

  const body = await c.req.parseBody();
  const newProfile = { 
    id: 'profile_' + Date.now(), 
    name: body.name as string, 
    calendarIds: [] 
  };
  
  session.settings.profiles.push(newProfile);
  saveSession(session);

  // Return to settings view to refresh the page
  return c.html(renderSettingsView(session));
});

app.delete('/profile/:id', (c) => {
  const session = getSession(c);
  if (!session) return c.text('', 401);

  const profileId = c.req.param('id');
  session.settings.profiles = session.settings.profiles.filter((p: any) => p.id !== profileId);
  
  // If deleted profile was active, switch to default
  if (session.settings.activeProfileId === profileId) {
    session.settings.activeProfileId = 'default';
  }
  
  saveSession(session);

  const isDarkMode = session.settings?.darkMode || false;
  const cal = session.settings.calendarUrls.find((c: any) => c.id === calendarId);
  const isSelected = profile.calendarIds.includes(calendarId);

  return c.html(`
    <label class="flex items-center gap-2 p-1.5 rounded cursor-pointer ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-100'}">
      <input
        type="checkbox"
        ${isSelected ? 'checked' : ''}
        hx-post="/profile/${profileId}/toggle-calendar"
        hx-vals='{"calendarId": "${calendarId}"}'
        hx-target="closest label"
        hx-swap="outerHTML"
        class="w-4 h-4 text-blue-600 rounded"
      />
      <span class="text-xs ${isDarkMode ? 'text-white' : 'text-gray-900'}">${cal?.name || 'Unknown'}</span>
    </label>
  `);
});

// Start server
export default { port: 8080, fetch: app.fetch };
console.log('🚀 Server running on http://localhost:8080');
