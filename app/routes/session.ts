// routes/session.ts - Session management: login, logout, profiles, dark mode

import { Hono } from 'hono';
import { getSession, createSession, destroySession, authenticateUser, loadHolidays, saveSessionData } from '../utils/auth';
import { loadUserSettings, saveUserSettings, saveSession, loadSession, deleteSession } from '../utils/storage'; 
import { renderLoginPage } from '../views/login';

const session = new Hono();

/**
 * Display login page
 */
session.get('/login', async (c) => {
  return c.html(renderLoginPage(false));
});

/**
 * Handle login form submission
 */
session.post('/login', async (c) => {
  const body = await c.req.parseBody();
  const username = body.username as string;
  const password = body.password as string;

  try {
    const settings = await authenticateUser(username, password);
    const holidays = await loadHolidays();
    createSession(c, username, password, settings, holidays);
    return c.redirect('/');
  } catch (error: any) {
    return c.html(renderLoginPage(false, error.message));
  }
});

/**
 * Handle logout
 */
session.post('/logout', async (c) => {
  destroySession(c);
  return c.html(renderLoginPage(false));
});

/**
 * Toggle dark mode (authenticated)
 */
session.post('/toggle-dark-mode', async (c) => {
  const sessionData = await getSession(c);
  if (!sessionData) return c.redirect('/login');
  
  sessionData.settings.darkMode = !sessionData.settings.darkMode;
  saveSessionData(sessionData);
  
  c.header('HX-Redirect', '/');
  return c.text('', 200);
});

/**
 * Toggle dark mode (anonymous - login page)
 */
session.post('/toggle-dark-mode-anon', async (c) => {
  const body = await c.req.parseBody();
  const isDark = body.isDark === 'true';
  return c.html(renderLoginPage(isDark));
});

/**
 * Switch active profile
 */
session.post('/switch-profile', async (c) => {
  const sessionData = await getSession(c);
  if (!sessionData) return c.redirect('/login');
  
  const body = await c.req.parseBody();
  sessionData.settings.activeProfileId = body.profile as string;
  saveSessionData(sessionData);
  
  return c.redirect('/');
});

/**
 * Add new profile
 */
session.post('/profile/add', async (c) => {
  const sessionData = await await getSession(c);
  if (!sessionData) {
    return c.text('');
  }

  const { name } = (await c.req.parseBody()) as { name?: string };
  const profileName = name?.trim();

  if (!profileName) {
    return c.html(
      `<div class="p-3 bg-red-100 text-red-700 rounded">Profilnamn krävs</div>`
    );
  }

  if (!Array.isArray(sessionData.settings.profiles)) {
    sessionData.settings.profiles = [];
  }

  const newProfile = {
    id: `profile_${Date.now()}`,
    name: profileName,
    calendarIds: []
  };

  sessionData.settings.profiles.push(newProfile);
  saveSessionData(sessionData);

  return c.html(`
    <div class="p-3 bg-green-100 text-green-700 rounded mb-2">
      ✅ Profil "${profileName}" skapad!
    </div>
    <script>
      (function () {
        var input = document.getElementById('profile-name-input');
        if (input) input.value = '';
        setTimeout(function () {
          htmx.ajax('GET', '/view/settings', {
            target: '#main-content',
            swap: 'innerHTML'
          });
        }, 1000);
      })();
    </script>
  `);
});

/**
 * Delete profile
 */
session.delete('/profile/:id', async (c) => {
  const sessionData = await getSession(c);
  if (!sessionData) return c.text('');
  
  const profileId = c.req.param('id');
  
  // Prevent deleting the last profile
  if (sessionData.settings.profiles.length <= 1) {
    return c.text('Cannot delete last profile', 400);
  }
  
  sessionData.settings.profiles = sessionData.settings.profiles.filter((p: any) => p.id !== profileId);
  
  // If deleting active profile, switch to first available
  if (sessionData.settings.activeProfileId === profileId) {
    sessionData.settings.activeProfileId = sessionData.settings.profiles[0]?.id || 'default';
  }
  
  saveSessionData(sessionData);
  return c.text('');
});

/**
 * Toggle calendar in profile
 */
session.post('/profile/:id/toggle-calendar', async (c) => {
  const sessionData = await getSession(c);
  if (!sessionData) return c.text('');
  
  const profileId = c.req.param('id');
  const body = await c.req.parseBody();
  const calendarId = body.calendarId as string;
  
  sessionData.settings.profiles = sessionData.settings.profiles.map((p: any) => {
    if (p.id !== profileId) return p;
    const calendarIds = p.calendarIds || [];
    const hasCalendar = calendarIds.includes(calendarId);
    return { 
      ...p, 
      calendarIds: hasCalendar 
        ? calendarIds.filter((id: string) => id !== calendarId) 
        : [...calendarIds, calendarId] 
    };
  });
  
  saveSessionData(sessionData);
  
  const profileData = sessionData.settings.profiles.find((p: any) => p.id === profileId);
  const calendar = sessionData.settings.calendarUrls.find((c: any) => c.id === calendarId);
  const isSelected = profileData?.calendarIds?.includes(calendarId);
  const isDarkMode = sessionData.settings.darkMode || false;
  
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
      <span class="text-xs ${isDarkMode ? 'text-white' : 'text-gray-900'}">${calendar?.name || ''}</span>
    </label>
  `);
});

export default session;
