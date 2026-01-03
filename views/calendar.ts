export function renderCalendarView(session: any) {
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
