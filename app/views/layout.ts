// views/layout.ts - Main layout, header, menu, and calendar view switcher with Heroicons

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
    .icon-button { transition: all 0.2s ease-in-out; }
    .icon-button:hover { transform: translateY(-1px); }
    .icon-button:active { transform: translateY(0); }
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
              class="icon-button p-2 rounded-lg ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}"
              title="Meny"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div class="flex items-center gap-2">
              <svg class="w-7 h-7 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h1 class="text-xl font-bold">Kalendervyn</h1>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <div class="relative">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'} pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <select 
                name="profile" 
                hx-post="/switch-profile" 
                hx-target="body" 
                hx-swap="outerHTML"
                class="pl-9 pr-4 py-2 rounded-lg border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'} appearance-none cursor-pointer hover:border-blue-400 transition-colors"
              >
                ${profiles.map((p: any) => `<option value="${p.id}" ${p.id === activeProfileId ? 'selected' : ''}>${p.name}</option>`).join('')}
              </select>
            </div>
            <button 
              hx-post="/toggle-dark-mode" 
              hx-target="body" 
              hx-swap="outerHTML"
              class="icon-button p-2 rounded-lg ${isDarkMode ? 'text-yellow-400 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}"
              title="${isDarkMode ? 'Ljust läge' : 'Mörkt läge'}"
            >
              ${isDarkMode ? `
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ` : `
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              `}
            </button>
            <button 
              hx-post="/logout" 
              hx-target="body" 
              hx-swap="outerHTML" 
              class="icon-button p-2 rounded-lg ${isDarkMode ? 'text-red-400 hover:bg-gray-700' : 'text-red-600 hover:bg-gray-100'}" 
              title="Inloggad som ${session.username}"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
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
    <div class="fixed inset-0 bg-black bg-opacity-50 z-40 backdrop-blur-sm" onclick="this.parentElement.innerHTML = ''"></div>
    <div class="fixed left-0 top-0 h-full w-72 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} shadow-2xl z-50">
      <div class="p-6">
        <div class="flex items-center justify-between mb-8">
          <h2 class="text-xl font-bold flex items-center gap-2">
            <svg class="w-6 h-6 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
            Meny
          </h2>
          <button 
            onclick="document.getElementById('menu-container').innerHTML = ''" 
            class="icon-button p-2 rounded-lg ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}"
            title="Stäng"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav class="space-y-2">
          <button 
            hx-get="/view/calendar" 
            hx-target="#main-content" 
            hx-swap="innerHTML"
            onclick="setTimeout(() => document.getElementById('menu-container').innerHTML = '', 100)" 
            class="w-full flex items-center gap-3 px-4 py-3 rounded-lg ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'} text-left transition-all group"
          >
            <svg class="w-5 h-5 ${isDarkMode ? 'group-hover:text-blue-400' : 'group-hover:text-blue-600'} transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span class="font-medium">Kalendervy</span>
          </button>
          <button 
            hx-get="/view/convert" 
            hx-target="#main-content" 
            hx-swap="innerHTML"
            onclick="setTimeout(() => document.getElementById('menu-container').innerHTML = '', 100)" 
            class="w-full flex items-center gap-3 px-4 py-3 rounded-lg ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'} text-left transition-all group"
          >
            <svg class="w-5 h-5 ${isDarkMode ? 'group-hover:text-green-400' : 'group-hover:text-green-600'} transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span class="font-medium">CSV till ICS</span>
          </button>
          <button 
            hx-get="/view/settings" 
            hx-target="#main-content" 
            hx-swap="innerHTML"
            onclick="setTimeout(() => document.getElementById('menu-container').innerHTML = '', 100)" 
            class="w-full flex items-center gap-3 px-4 py-3 rounded-lg ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-100'} text-left transition-all group"
          >
            <svg class="w-5 h-5 ${isDarkMode ? 'group-hover:text-purple-400' : 'group-hover:text-purple-600'} transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span class="font-medium">Inställningar</span>
          </button>
        </nav>
        
        <div class="mt-8 pt-6 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}">
          <div class="text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'} flex items-center gap-2">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>TimeCare Kalender v1.0</span>
          </div>
        </div>
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
        <h2 class="text-2xl font-bold flex items-center gap-2">
          <svg class="w-7 h-7 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Mina händelser
        </h2>
        <div class="flex gap-2">
          <button
            hx-get="/view/calendar/list"
            hx-target="#calendar-content"
            hx-swap="innerHTML"
            class="icon-button px-4 py-2 rounded-lg flex items-center gap-2 ${isDarkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'} transition-all shadow-sm hover:shadow-md"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            <span>Lista</span>
          </button>
          <button
            hx-get="/view/calendar/month"
            hx-target="#calendar-content"
            hx-swap="innerHTML"
            class="icon-button px-4 py-2 rounded-lg flex items-center gap-2 ${isDarkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'} transition-all shadow-sm hover:shadow-md"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Månad</span>
          </button>
        </div>
      </div>

      <div id="calendar-content">
        <div class="text-center py-12">
          <svg class="w-8 h-8 animate-spin inline-block ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <p class="mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}">Laddar kalender...</p>
        </div>
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
