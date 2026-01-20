// views/calendar.ts - Calendar view wrapper with shared refresh status

export function renderCalendarView(session: any) {
  const isDarkMode = session.settings?.darkMode || false;

  return `
    <div>
      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-2xl font-bold">Mina händelser</h2>
        <div class="flex gap-2">
          <button
            onclick="window.tcAppSkipBackgroundCheck = true;"
            hx-get="/view/calendar/list"
            hx-target="#calendar-content"
            hx-swap="innerHTML"
            class="px-4 py-2 rounded-lg flex items-center gap-2 ${isDarkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}"
          >
            📋 Lista
          </button>
          <button
            onclick="window.tcAppSkipBackgroundCheck = true;"
            hx-get="/view/calendar/month"
            hx-target="#calendar-content"
            hx-swap="innerHTML"
            class="px-4 py-2 rounded-lg flex items-center gap-2 ${isDarkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}"
          >
            📅 Månad
          </button>
        </div>
      </div>

      <!-- Shared refresh status area -->
      <div class="mb-4 text-center">
        <div
            id="refresh-status"
            hx-get="/calendar/refresh-status"
            hx-trigger="load, every 60s"
            hx-swap="innerHTML"
            hx-target="this"
            class="inline-block"
        >
          <span class="text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}">Laddar status...</span>
        </div>
      </div>

      <div id="calendar-content">
        <div class="text-center py-12">Laddar kalender...</div>
      </div>
    </div>
    
    <script>
      (function() {
        var hasRunInitialCheck = false;
        
        // Load calendar with saved date
        var savedDate = sessionStorage.getItem('tcapp_selected_date');
        var url = savedDate 
          ? '/view/calendar/list?date=' + savedDate
          : '/view/calendar/list';
        
        // Load initial content
        htmx.ajax('GET', url, {
          target: '#calendar-content',
          swap: 'innerHTML'
        });
        
        // Background check function
        function checkForChanges() {
          if (hasRunInitialCheck || window.tcAppSkipBackgroundCheck) {
            window.tcAppSkipBackgroundCheck = false;
            return;
          }
          hasRunInitialCheck = true;
          
          // Show checking status
          var statusEl = document.getElementById('refresh-status');
          if (statusEl) {
            htmx.ajax('GET', '/calendar/refresh-status?checking=true', {
              target: '#refresh-status',
              swap: 'innerHTML'
            });
          }
          
          // Check for changes
          fetch('/calendar/check-changes')
            .then(function(response) { return response.json(); })
            .then(function(result) {
              if (result.needsReload) {
                // Reload list view silently
                var calendarContent = document.getElementById('calendar-content');
                if (calendarContent) {
                  var dateInput = document.getElementById('date-picker');
                  var currentDate = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
                  var editMode = document.querySelector('.event-checkbox') !== null;
                  
                  htmx.ajax('GET', '/view/calendar/list?date=' + currentDate + '&editMode=' + editMode, {
                    target: '#calendar-content',
                    swap: 'innerHTML'
                  });
                }
              }
              
              // Update status display
              setTimeout(function() {
                htmx.ajax('GET', '/calendar/refresh-status', {
                  target: '#refresh-status',
                  swap: 'innerHTML'
                });
              }, 500);
            })
            .catch(function(error) {
              console.error('Background check failed:', error);
              htmx.ajax('GET', '/calendar/refresh-status', {
                target: '#refresh-status',
                swap: 'innerHTML'
              });
            });
        }
        
        // Run background check once after 2 seconds
        setTimeout(checkForChanges, 2000);
      })();
    </script>
  `;
}
