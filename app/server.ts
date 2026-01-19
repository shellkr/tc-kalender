// server.ts - Main server file with consolidated modular routes
import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { getSession } from './utils/auth';
import { initStorage } from './utils/storage';
import { renderLayout, renderHeader, renderMenu } from './views/layout';

// Import consolidated route modules
import session from './routes/session';
import calendar from './routes/calendar';
import keywords from './routes/keywords';

const app = new Hono();

// ==================== STATIC FILES ====================

/**
 * Serve static files from public directory
 */
app.use('/static/*', serveStatic({ root: './public' }));
app.get('/favicon.png', serveStatic({ path: './public/favicon.png' }));

// ==================== HOME PAGE ====================

/**
 * Home page - shows calendar or redirects to login
 * THIS IS THE ONLY ROUTE that checks for calendar updates on browser refresh
 */
app.get('/', async (c) => {
  // skipCalendarCheck = false (default) - checks for calendar changes
  const sessionData = await getSession(c);
  
  if (!sessionData) {
    return c.redirect('/login');
  }

  const isDarkMode = sessionData.settings?.darkMode || false;
  const content = `
    ${renderHeader(sessionData)}
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div id="main-content" hx-get="/view/calendar" hx-trigger="load" hx-swap="innerHTML">
        <div class="text-center py-12">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p class="mt-2 text-gray-600">Laddar...</p>
        </div>
      </div>
    </main>
  `;
  
  return c.html(renderLayout(content, isDarkMode));
});

/**
 * Render navigation menu
 */
app.get('/menu', async (c) => {
  const sessionData = await getSession(c, true); // Skip check
  
  if (!sessionData) return c.text('');
  
  const isDarkMode = sessionData.settings?.darkMode || false;
  return c.html(renderMenu(isDarkMode));
});

// ==================== MOUNT ROUTE MODULES ====================

/**
 * Session routes: login, logout, profiles, dark mode
 * Routes: /login, /logout, /toggle-dark-mode*, /switch-profile, /profile/*
 */
app.route('/', session);

/**
 * Calendar routes: views, management, events
 * Routes: /view/calendar/*, /calendar/*, /event/*
 */
app.route('/', calendar);

/**
 * Keywords routes: settings, rules, CSV conversion
 * Routes: /view/settings, /view/convert, /keyword/*, /convert/*
 */
app.route('/', keywords);

// ==================== ERROR HANDLERS ====================

/**
 * 404 handler
 */
app.notFound(async (c) => {
  const sessionData = await getSession(c, true); // Skip check
  const isDarkMode = sessionData?.settings?.darkMode || false;
  
  const content = `
    <div class="min-h-screen flex items-center justify-center">
      <div class="text-center">
        <h1 class="text-6xl font-bold text-gray-300">404</h1>
        <p class="text-xl mt-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}">Sidan hittades inte</p>
        <a href="/" class="mt-6 inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Gå till startsidan
        </a>
      </div>
    </div>
  `;
  
  return c.html(renderLayout(content, isDarkMode), 404);
});

/**
 * Error handler
 */
app.onError(async (err, c) => {
  console.error('Server error:', err);
  
  const sessionData = await getSession(c, true); // Skip check
  const isDarkMode = sessionData?.settings?.darkMode || false;
  
  const content = `
    <div class="min-h-screen flex items-center justify-center">
      <div class="text-center">
        <h1 class="text-6xl font-bold text-red-500">500</h1>
        <p class="text-xl mt-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}">Ett serverfel inträffade</p>
        <a href="/" class="mt-6 inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Gå till startsidan
        </a>
      </div>
    </div>
  `;
  
  return c.html(renderLayout(content, isDarkMode), 500);
});

// ==================== START SERVER ====================

/**
 * Export server configuration for Bun
 */
export default { 
  port: 3000, 
  fetch: app.fetch 
};

// Log startup information
initStorage().then(async () => {
  console.log('🚀 TimeCare Kalender App');
  console.log('   Server: http://localhost:3000');
  console.log('   Environment: ' + (process.env.NODE_ENV || 'development'));
  console.log('');
  console.log('');
  console.log('✅ Server ready and listening...');
}).catch(err => {
  console.error('❌ Failed to initialize storage:', err);
});
