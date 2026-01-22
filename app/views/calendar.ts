// views/calendar.ts - Calendar view wrapper with HTMX-based refresh

export function renderCalendarView(session: any) {
  const isDarkMode = session.settings?.darkMode || false;

  return `
    <div>
      <div class="mb-4 flex items-center justify-between">
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

      <div class="mb-4">
        <div id="refresh-result"></div>
        <div class="text-center">
          <div 
            id="refresh-status"
            hx-get="/calendar/refresh-status"
            hx-trigger="load delay:100ms, every 600s"
            hx-swap="innerHTML"
          >
            <span class="text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}">Laddar status...</span>
          </div>
        </div>
      </div>

      <div 
        id="calendar-content"
        hx-get="/view/calendar/list"
        hx-trigger="load delay:100ms, calendarUpdated from:body"
        hx-swap="innerHTML"
      >
        <div class="text-center py-12">Laddar kalender...</div>
      </div>
      
      <div
        id="background-checker"
        hx-get="/calendar/check-background"
        hx-trigger="load delay:2s once"
        hx-swap="none"
        style="display:none;"
      ></div>
    </div>
  `;
}
