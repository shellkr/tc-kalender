// views/layout.ts - Main layout, header, menu, and calendar view switcher

/**
 * Render the main HTML layout with HTMX and Tailwind
 */
export function renderLayout(content: string, isDarkMode = false): string {
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

/**
 * Render the header component with navigation and profile selector
 */
export function renderHeader(session: any): string {
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

/**
 * Render the navigation menu (sidebar)
 */
export function renderMenu(isDarkMode: boolean): string {
  return `
    <div class="fixed inset-0 bg-black bg-opacity-50 z-40" onclick="this.parentElement.innerHTML = ''"></div>
    <div class="fixed left-0 top-0 h-full w-64 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg z-50">
      <div class="p-4">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-lg font-bold">Meny</h2>
          <button 
            onclick="document.getElementById('menu-container').innerHTML = ''" 
            class="p-2 rounded-lg ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}"
          >
            ✕
          </button>
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
  `;
}

/**
 * Render the main calendar view with view switcher (list/month)
 */
export function renderCalendarView(session: any): string {
  const isDarkMode = session.settings?.darkMode || false;

  return `
    <div>
      <div class="mb-6 flex items-center justify-between">
        <h2 class="text-2xl font-bold">Mina händelser</h2>
        <div class="flex gap-2">
          <button
            hx-get="/view/calendar/list"
            hx-target="#calendar-content"
            hx-swap="innerHTML"
            class="px-4 py-2 rounded-lg flex items-center gap-2 ${isDarkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}"
          >
            📋 Lista
          </button>
          <button
            hx-get="/view/calendar/month"
            hx-target="#calendar-content"
            hx-swap="innerHTML"
            class="px-4 py-2 rounded-lg flex items-center gap-2 ${isDarkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}"
          >
            📅 Månad
          </button>
        </div>
      </div>

      <div id="calendar-content">
        <div class="text-center py-12">Laddar kalender...</div>
      </div>
    </div>
    
    <script>
      (function() {
        // Load calendar with saved date
        const savedDate = sessionStorage.getItem('tcapp_selected_date');
        const url = savedDate 
          ? '/view/calendar/list?date=' + savedDate
          : '/view/calendar/list';
        
        // Load initial content
        htmx.ajax('GET', url, {
          target: '#calendar-content',
          swap: 'innerHTML'
        });
      })();
    </script>
  `;
}
