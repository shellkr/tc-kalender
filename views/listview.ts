export function renderListView(session: any, startDate?: string, isEditMode: boolean = false) {
  const isDarkMode = session.settings?.darkMode || false;
  const events = session.events || [];
  const profiles = session.settings?.profiles || [];
  const activeProfileId = session.settings?.activeProfileId || 'default';
  const activeProfile = profiles.find((p: any) => p.id === activeProfileId);
  const visibleCalendarIds = activeProfile?.calendarIds || [];
  const hiddenEvents = session.hiddenEvents || [];
  
  const filteredEvents = events
    .filter((e: any) => !e.calendarId || visibleCalendarIds.includes(e.calendarId))
    .filter((e: any) => {
      const eventKey = `${e.calendarId}_${e.summary}_${e.start}`;
      return !hiddenEvents.includes(eventKey);
    })
    .sort((a: any, b: any) => {
      const aDate = typeof a.start === 'string' ? new Date(a.start) : a.start;
      const bDate = typeof b.start === 'string' ? new Date(b.start) : b.start;
      return aDate.getTime() - bDate.getTime();
    });

  const cardClasses = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const today = startDate || new Date().toISOString().split('T')[0];

  return `
    <style>
      /* Week column styling - thick right border always visible */
      .week-cell {
        border-right: 2px solid ${isDarkMode ? '#6b7280' : '#4b5563'} !important;
        border-top: transparent !important;
        border-bottom: transparent !important;
        border-left: transparent !important;
        background-color: ${isDarkMode ? '#1f2937' : '#f3f4f6'};
        color: ${isDarkMode ? '#9ca3af' : '#6b7280'};
        font-weight: 500;
        text-align: center;
        vertical-align: middle;
      }
      
      /* Week separator - thick top border for first row of new week */
      .week-separator {
        border-top: 2px solid ${isDarkMode ? '#6b7280' : '#4b5563'} !important;
      }
      
      /* Regular row border - thin border between rows in different days */
      .row-border {
        border-top: 1px solid ${isDarkMode ? '#374151' : '#e5e7eb'} !important;
      }
      
      /* No border between events on the same day */
      .same-day-event {
        border-top: none !important;
      }
      
      /* Remove all other borders from table cells */
      .calendar-table td {
        border: none !important;
      }
      
      /* Header border */
      .header-cell {
        border-bottom: 2px solid ${isDarkMode ? '#4b5563' : '#d1d5db'} !important;
      }
    </style>
    
    <div class="space-y-6">
      <div class="rounded-lg shadow-sm border p-4 ${cardClasses}">
        <div class="flex flex-wrap gap-4 items-center justify-between">
          <div class="flex items-center gap-2">
            <label class="text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-700'}">Från datum:</label>
            <input
              type="date"
              id="date-picker"
              name="start_date"
              value="${today}"
              class="px-3 py-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}"
            />
            <button
              hx-get="/view/calendar/list?date=${today}&editMode=false"
              hx-trigger="click from:#date-picker"
              hx-vals="js:{date: document.getElementById('date-picker').value, editMode: '${isEditMode}'}"
              hx-target="#calendar-content"
              hx-swap="innerHTML"
              style="display: none;"
            ></button>
            <script>
              document.getElementById('date-picker').addEventListener('change', function(e) {
                const newDate = e.target.value;
                const editMode = ${isEditMode};
                htmx.ajax('GET', '/view/calendar/list?date=' + newDate + '&editMode=' + editMode, {
                  target: '#calendar-content',
                  swap: 'innerHTML'
                });
              });
            </script>
          </div>
          <div class="flex gap-2">
            <button
              hx-get="/view/calendar/list?date=${today}&editMode=${!isEditMode}"
              hx-target="#calendar-content"
              hx-swap="innerHTML"
              class="flex items-center gap-2 px-4 py-2 ${isEditMode ? 'bg-gray-600 hover:bg-gray-700' : 'bg-orange-600 hover:bg-orange-700'} text-white rounded-lg transition-colors"
            >
              ${isEditMode ? '✕ Avsluta redigering' : '✏️ Redigera'}
            </button>
            <button
              onclick="window.print()"
              ${isEditMode ? 'disabled' : ''}
              class="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 ${isEditMode ? 'opacity-50 cursor-not-allowed' : ''}"
            >
              🖨️ Skriv ut
            </button>
          </div>
        </div>
      </div>

      ${isEditMode ? `
        <div class="rounded-lg shadow-sm border p-4 ${cardClasses}">
          <div class="flex flex-wrap gap-2 items-center justify-between">
            <div class="flex items-center gap-2">
              <span id="selected-count" class="text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}">
                0 händelse(r) markerade
              </span>
            </div>
            <div class="flex gap-2">
              <button
                onclick="toggleAllCheckboxes()"
                class="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Markera alla
              </button>
              <button
                onclick="deleteSelectedEvents()"
                id="delete-selected-btn"
                disabled
                class="flex items-center gap-2 px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🗑️ Ta bort markerade
              </button>
            </div>
          </div>
        </div>
        
        <script>
          function updateSelectedCount() {
            const checkboxes = document.querySelectorAll('.event-checkbox:checked');
            const count = checkboxes.length;
            const countElement = document.getElementById('selected-count');
            const deleteBtn = document.getElementById('delete-selected-btn');
            const selectAllCheckbox = document.getElementById('select-all-checkbox');
            
            if (countElement) {
              countElement.textContent = count + ' händelse(r) markerade';
            }
            
            if (deleteBtn) {
              deleteBtn.disabled = count === 0;
            }
            
            const totalCheckboxes = document.querySelectorAll('.event-checkbox').length;
            if (selectAllCheckbox) {
              selectAllCheckbox.checked = count === totalCheckboxes && count > 0;
            }
          }

          function toggleAllCheckboxes() {
            const selectAllCheckbox = document.getElementById('select-all-checkbox');
            const checkboxes = document.querySelectorAll('.event-checkbox');
            const shouldCheck = selectAllCheckbox ? selectAllCheckbox.checked : false;
            
            checkboxes.forEach(cb => {
              cb.checked = !shouldCheck;
            });
            
            updateSelectedCount();
          }

          function deleteSelectedEvents() {
            const checkboxes = document.querySelectorAll('.event-checkbox:checked');
            if (checkboxes.length === 0) {
              alert('Inga händelser markerade');
              return;
            }

            if (!confirm('Är du säker på att du vill ta bort ' + checkboxes.length + ' händelse(r)?')) {
              return;
            }

            const eventIds = Array.from(checkboxes).map(cb => cb.value);
            
            // Delete events one by one
            const deletePromises = eventIds.map(id => {
              return fetch('/event/' + id, {
                method: 'DELETE'
              });
            });

            Promise.all(deletePromises).then(() => {
              // Reload the list view
              const dateInput = document.getElementById('date-picker');
              const currentDate = dateInput ? dateInput.value : '${today}';
              htmx.ajax('GET', '/view/calendar/list?date=' + currentDate + '&editMode=true', {
                target: '#calendar-content',
                swap: 'innerHTML'
              });
            });
          }

          // Initialize
          updateSelectedCount();
        </script>
      ` : ''}

      <div class="rounded-lg shadow-sm border overflow-hidden ${cardClasses}">
        <div class="overflow-x-auto">
          <table class="calendar-table w-full text-sm border-collapse">
            <thead class="${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}">
              <tr>
                ${isEditMode ? `
                  <th class="header-cell px-2 py-2 text-center text-xs font-medium uppercase w-12 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}">
                    <input 
                      type="checkbox" 
                      id="select-all-checkbox" 
                      onclick="toggleAllCheckboxes()" 
                      class="w-4 h-4 text-blue-600 rounded" 
                    />
                  </th>
                ` : ''}
                <th class="header-cell px-2 py-2 text-center text-xs font-medium uppercase w-12 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}">V</th>
                <th class="header-cell px-3 py-2 text-left text-xs font-medium uppercase w-28 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}">DATUM</th>
                <th class="header-cell px-3 py-2 text-left text-xs font-medium uppercase w-24 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}">DAG</th>
                <th class="header-cell px-3 py-2 text-left text-xs font-medium uppercase ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}">HÄNDELSE</th>
                <th class="header-cell px-2 py-2 text-left text-xs font-medium uppercase w-20 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}">BÖRJAR</th>
                <th class="header-cell px-2 py-2 text-left text-xs font-medium uppercase w-20 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}">SLUTAR</th>
                <th class="header-cell px-3 py-2 text-left text-xs font-medium uppercase ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}">BESKRIVNING</th>
                ${!isEditMode ? `
                  <th class="header-cell px-2 py-2 text-center text-xs font-medium uppercase w-20 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}">ÅTGÄRD</th>
                ` : ''}
              </tr>
            </thead>
            <tbody>
              ${renderCalendarRows(today, 365, filteredEvents, isDarkMode, session.settings?.keywordRules || [], isEditMode)}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderCalendarRows(startDateStr: string, days: number, events: any[], isDarkMode: boolean, keywordRules: any[], isEditMode: boolean = false) {
  const startDate = new Date(startDateStr);
  const rows: string[] = [];
  
  // Group events by date for quick lookup
  const eventsByDate: { [key: string]: any[] } = {};
  events.forEach(event => {
    const date = typeof event.start === 'string' ? new Date(event.start) : event.start;
    const dateKey = date.toISOString().split('T')[0];
    if (!eventsByDate[dateKey]) {
      eventsByDate[dateKey] = [];
    }
    eventsByDate[dateKey].push(event);
  });
  
  // Generate all dates
  const allDates: Date[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    allDates.push(date);
  }
  
  // Group by week
  const weekGroups: { [key: string]: Date[] } = {};
  allDates.forEach(date => {
    const weekNumber = getWeekNumber(date);
    const weekKey = `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
    if (!weekGroups[weekKey]) {
      weekGroups[weekKey] = [];
    }
    weekGroups[weekKey].push(date);
  });
  
  // Render each week
  const weeks = Object.keys(weekGroups).sort();
  let isFirstWeek = true;
  
  weeks.forEach((weekKey) => {
    const weekDates = weekGroups[weekKey];
    const weekNumber = getWeekNumber(weekDates[0]);
    let weekRowCount = 0;
    
    // Count total rows for this week
    weekDates.forEach(date => {
      const dateKey = date.toISOString().split('T')[0];
      const dayEvents = eventsByDate[dateKey] || [];
      weekRowCount += Math.max(1, dayEvents.length);
    });
    
    // Track if we've added the week number cell for this week
    let isFirstRowOfWeek = true;
    
    weekDates.forEach((date, dateIdx) => {
      const dateKey = date.toISOString().split('T')[0];
      const dayEvents = eventsByDate[dateKey] || [];
      const weekDays = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
      const dayName = weekDays[date.getDay()];
      const isRedDay = date.getDay() === 0 || date.getDay() === 6;
      
      // Determine border class
      const isFirstDayOfWeek = dateIdx === 0;
      
      let borderClass = '';
      if (!isFirstWeek && isFirstDayOfWeek) {
        borderClass = 'week-separator';
      } else if (dateIdx > 0) {
        borderClass = 'row-border';
      }
      
      if (dayEvents.length === 0) {
        // No events for this day - single row
        rows.push(`
          <tr class="${borderClass}">
            ${isEditMode ? `<td class="px-2 py-2 text-center"></td>` : ''}
            ${isFirstRowOfWeek ? `
              <td rowspan="${weekRowCount}" class="week-cell px-2 py-2 text-xs">
                ${String(weekNumber).padStart(2, '0')}
              </td>
            ` : ''}
            <td class="px-3 py-2 text-xs">${date.toLocaleDateString('sv-SE')}</td>
            <td class="px-3 py-2 text-xs ${isRedDay ? 'text-red-600 font-bold' : ''}">${dayName}</td>
            <td class="px-3 py-2 text-xs text-gray-500">-</td>
            <td class="px-3 py-2 text-xs">-</td>
            <td class="px-3 py-2 text-xs">-</td>
            <td class="px-3 py-2 text-xs">-</td>
            ${!isEditMode ? `<td class="px-2 py-2 text-center"></td>` : ''}
          </tr>
        `);
        isFirstRowOfWeek = false;
      } else {
        // Has events - one row per event
        dayEvents.forEach((event: any, eventIdx: number) => {
          const eventDate = typeof event.start === 'string' ? new Date(event.start) : event.start;
          const endDate = event.end ? (typeof event.end === 'string' ? new Date(event.end) : event.end) : eventDate;
          const eventColor = getEventColor(event.summary, keywordRules);
          const isWholeDay = eventDate.getHours() === 0 && eventDate.getMinutes() === 0 && 
                             endDate.getHours() === 0 && endDate.getMinutes() === 0 &&
                             endDate.getDate() !== eventDate.getDate();
          
          const isFirstEventOfDay = eventIdx === 0;
          
          // Determine border for this event row
          let eventBorderClass = '';
          if (isFirstEventOfDay) {
            eventBorderClass = borderClass;
          } else {
            eventBorderClass = 'same-day-event';
          }
          
          rows.push(`
            <tr class="${eventBorderClass}">
              ${isEditMode ? `
                <td class="px-2 py-2 text-center">
                  <input 
                    type="checkbox" 
                    class="event-checkbox w-4 h-4 text-blue-600 rounded" 
                    value="${event.id}"
                    onchange="updateSelectedCount()"
                  />
                </td>
              ` : ''}
              ${isFirstRowOfWeek ? `
                <td rowspan="${weekRowCount}" class="week-cell px-2 py-2 text-xs">
                  ${String(weekNumber).padStart(2, '0')}
                </td>
              ` : ''}
              ${isFirstEventOfDay ? `
                <td rowspan="${dayEvents.length}" class="px-3 py-2 text-xs">${date.toLocaleDateString('sv-SE')}</td>
                <td rowspan="${dayEvents.length}" class="px-3 py-2 text-xs ${isRedDay ? 'text-red-600 font-bold' : ''}">${dayName}</td>
              ` : ''}
              <td class="px-3 py-2">
                <div class="flex items-center gap-2">
                  <span class="inline-block px-2 py-1 rounded text-xs font-medium" style="background-color: ${eventColor.bg}; color: ${eventColor.text}">
                    ${event.summary}
                  </span>
                  ${isEditMode ? `
                    <button
                      hx-delete="/event/${event.id}"
                      hx-confirm="Är du säker?"
                      hx-target="closest tr"
                      hx-swap="outerHTML swap:0.5s"
                      class="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                      title="Ta bort händelse"
                    >
                      ✕
                    </button>
                  ` : ''}
                </div>
              </td>
              <td class="px-2 py-2 text-xs">
                ${isWholeDay ? 'Heldag' : eventDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
              </td>
              <td class="px-2 py-2 text-xs">
                ${isWholeDay ? 'Heldag' : endDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
              </td>
              <td class="px-3 py-2 text-xs">${event.description || '-'}</td>
              ${!isEditMode ? `
                <td class="px-2 py-2 text-center">
                  <button
                    hx-delete="/event/${event.id}"
                    hx-confirm="Är du säker?"
                    hx-target="closest tr"
                    hx-swap="outerHTML swap:0.5s"
                    class="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                  >
                    🗑️
                  </button>
                </td>
              ` : ''}
            </tr>
          `);
          isFirstRowOfWeek = false;
        });
      }
    });
    
    isFirstWeek = false;
  });
  
  return rows.join('');
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getEventColor(summary: string, rules: any[]) {
  const lowerSummary = summary.toLowerCase();
  for (const rule of rules) {
    if (rule.keywords.some((k: string) => lowerSummary.includes(k.toLowerCase()))) {
      return { bg: rule.color, text: rule.textColor || '#ffffff' };
    }
  }
  return { bg: 'rgb(183, 183, 183)', text: '#ffffff' };
}
