// views/listview.ts - Complete list view with smart background refresh

export function getWeekNumber(date: Date): number {
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

function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isSpecialEvent(eventSummary: string, keywords: string[]): boolean {
  const summary = eventSummary.toLowerCase();
  return keywords.some(keyword => summary.includes(keyword.toLowerCase()));
}

function getNextSunday(fromDate: Date): Date {
  const date = new Date(fromDate);
  const dayOfWeek = date.getDay();
  const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
  date.setDate(date.getDate() + daysUntilSunday);
  return date;
}

export function renderListView(session: any, startDate?: string, isEditMode: boolean = false, skipCheck: boolean = false) {
  const isDarkMode = session.settings?.darkMode || false;
  const events = session.events || [];
  const profiles = session.settings?.profiles || [];
  const activeProfileId = session.settings?.activeProfileId || 'default';
  const activeProfile = profiles.find((p: any) => p.id === activeProfileId);
  const visibleCalendarIds = activeProfile?.calendarIds || [];
  const hiddenEvents = session.hiddenEvents || [];
  const holidays = session.holidays || {};
  
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
  
  let selectedDate = startDate || new Date().toISOString().split('T')[0];
  
  if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
    selectedDate = new Date().toISOString().split('T')[0];
  }

  const calendarRows = renderCalendarRows(selectedDate, 365, filteredEvents, isDarkMode, session.settings?.keywordRules || [], isEditMode, holidays);

  return `
    <style>
      .week-cell {
        border-right: 1px solid ${isDarkMode ? '#6b7280' : '#9ca3af'} !important;
        border-top: transparent !important;
        border-bottom: transparent !important;
        border-left: transparent !important;
        background-color: ${isDarkMode ? '#1f2937' : '#f3f4f6'};
        color: ${isDarkMode ? '#9ca3af' : '#6b7280'};
        font-weight: 500;
        text-align: center;
        vertical-align: middle;
      }
      
      .arrow-cell {
        width: 10px;
        min-width: 10px;
        max-width: 10px;
        padding: 0 !important;
        margin: 0 !important;
        border-top: transparent !important;
        border-bottom: transparent !important;
        border-left: 1px solid ${isDarkMode ? '#6b7280' : '#d1d5db'} !important;
        border-right: 0px solid ${isDarkMode ? '#6b7280' : '#d1d5db'} !important;
        background-color: ${isDarkMode ? '#1f2937' : '#fff'} !important;
        position: relative;
      }
      
      .arrow-cell.week-separator {
        border-top: 2px solid ${isDarkMode ? '#9ca3af' : '#6b7280'} !important;
      }
      
      .arrow-line {
        position: absolute;
        left: 56%;
        top: 0;
        bottom: 0;
        width: 0;
        border-left: 2px solid #dc2626;
        transform: translateX(-60%);
      }
      
      .arrow-line.arrow-end::before {
        content: '';
        position: absolute;
        bottom: -1px;
        left: 50%;
        transform: translateX(-60%);
        width: 0;
        height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-top: 6px solid #dc2626;
      }
      
      .arrow-line.arrow-start::after {
        content: '';
        position: absolute;
        top: -1px;
        left: 50%;
        transform: translateX(-60%);
        width: 6px;
        height: 6px;
        background-color: #dc2626;
        border-radius: 50%;
      }
      
      .calendar-table td:not(.week-cell):not(.arrow-cell) {
        border-left: 1px solid ${isDarkMode ? '#374151' : '#e5e7eb'};
      }
      
      .calendar-table td:first-child + .week-cell + td {
        border-left: none;
      }
      
      .week-separator {
        border-top: 2px solid ${isDarkMode ? '#6b7280' : '#4b5563'} !important;
      }
      
      .row-border {
        border-top: 1px solid ${isDarkMode ? '#374151' : '#e5e7eb'} !important;
      }
      
      .same-day-event {
        border-top: none !important;
      }
      
      .calendar-table td {
        border: none !important;
      }
      
      .header-cell {
        border-bottom: 2px solid ${isDarkMode ? '#4b5563' : '#d1d5db'} !important;
      }
      
      .holiday-text {
        color: #dc2626 !important;
        font-weight: bold;
      }
    </style>
    
    <div class="space-y-6">
      <div class="rounded-lg shadow-sm border p-4 ${cardClasses}">
        <div class="flex flex-wrap gap-4 items-center justify-between">
          <div class="flex flex-wrap items-center gap-2">
            <label class="text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-700'}">Från datum:</label>
            <input
              type="date"
              id="date-picker"
              value="${selectedDate}"
              class="px-3 py-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}"
              style="min-width: 150px;"
            />
            <button
              id="today-btn"
              type="button"
              class="flex items-center gap-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              🔄 Idag
            </button>
            <script>
              (function() {
                const picker = document.getElementById('date-picker');
                const todayBtn = document.getElementById('today-btn');
                
                if (picker) {
                  const editMode = ${isEditMode};
                  
                  picker.addEventListener('change', function(e) {
                    const newDate = e.target.value;
                    if (newDate && /^\\d{4}-\\d{2}-\\d{2}$/.test(newDate)) {
                      htmx.ajax('GET', '/view/calendar/list?date=' + newDate + '&editMode=' + editMode, {
                        target: '#calendar-content',
                        swap: 'innerHTML'
                      });
                    }
                  });
                }
                
                if (todayBtn) {
                  todayBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    const today = new Date();
                    const yyyy = today.getFullYear();
                    const mm = String(today.getMonth() + 1).padStart(2, '0');
                    const dd = String(today.getDate()).padStart(2, '0');
                    const todayStr = yyyy + '-' + mm + '-' + dd;
                    
                    if (picker) {
                      picker.value = todayStr;
                    }
                    
                    htmx.ajax('GET', '/view/calendar/list?date=' + todayStr + '&editMode=false', {
                      target: '#calendar-content',
                      swap: 'innerHTML'
                    });
                  });
                }
              })();
            </script>
          </div>
          <div class="flex gap-2">
            <button
              hx-post="/calendar/refresh"
              hx-target="#refresh-result"
              hx-swap="innerHTML"
              class="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              title="Hämta nya händelser från kalendrar"
            >
              🔄 Uppdatera
            </button>
            <button
              hx-get="/view/calendar/list?date=${selectedDate}&editMode=${!isEditMode}"
              hx-target="#calendar-content"
              hx-swap="innerHTML"
              class="flex items-center gap-2 px-4 py-2 ${isEditMode ? 'bg-gray-600 hover:bg-gray-700' : 'bg-orange-600 hover:bg-orange-700'} text-white rounded-lg transition-colors"
            >
              ${isEditMode ? '✕ Avsluta redigering' : '✏️ Redigera'}
            </button>
            <button
              onclick="window.open('/view/calendar/print?date=${selectedDate}', '_blank')"
              ${isEditMode ? 'disabled' : ''}
              class="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 ${isEditMode ? 'opacity-50 cursor-not-allowed' : ''}"
            >
              🖨️ Skriv ut
            </button>
          </div>
        </div>
      </div>

      <!-- Refresh result display -->
      <div id="refresh-result" class="mt-2"></div>

      ${!skipCheck ? `
        <!-- Background calendar checker with spinner -->
        <div
          id="calendar-checker"
          hx-get="/calendar/background-check?currentView=list&date=${selectedDate}"
          hx-trigger="load delay:500ms"
          hx-swap="outerHTML"
          class="fixed bottom-4 right-4 ${isDarkMode ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-white border-gray-200 text-gray-700'} rounded-lg shadow-lg px-4 py-2 flex items-center gap-2 border"
        >
          <div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span class="text-sm">Kontrollerar kalendrar...</span>
        </div>
      ` : ''}

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
            const shouldCheck = selectAllCheckbox ? !selectAllCheckbox.checked : true;
            
            checkboxes.forEach(cb => {
              cb.checked = shouldCheck;
            });
            
            if (selectAllCheckbox) {
              selectAllCheckbox.checked = shouldCheck;
            }
            
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
            
            const deletePromises = eventIds.map(id => {
              return fetch('/event/' + id, {
                method: 'DELETE'
              });
            });

            Promise.all(deletePromises).then(() => {
              const dateInput = document.getElementById('date-picker');
              const currentDate = dateInput ? dateInput.value : '${selectedDate}';
              htmx.ajax('GET', '/view/calendar/list?date=' + currentDate + '&editMode=true', {
                target: '#calendar-content',
                swap: 'innerHTML'
              });
            });
          }

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
                <th class="header-cell px-2 py-2 text-center text-xs font-medium uppercase w-12 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}" style="width: 30px;">V</th>
                <th class="header-cell px-3 py-2 text-left text-xs font-medium uppercase w-28 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}" style="width: 60px;">DATUM</th>
                <th class="header-cell px-3 py-2 text-left text-xs font-medium uppercase w-24 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}" style="width: 60px;">DAG</th>
                <th class="header-cell px-0 py-2 text-center text-xs font-medium uppercase ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}" style="width: 10px; min-width: 10px; max-width: 10px; padding: 0.375rem 0;"></th>
                <th class="header-cell px-2 py-2 text-left text-xs font-medium uppercase ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}" style="width: 60px;">HÄNDELSE</th>
                <th class="header-cell px-2 py-2 text-left text-xs font-medium uppercase ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}" style="width: 60px;">BÖRJAR</th>
                <th class="header-cell px-2 py-2 text-left text-xs font-medium uppercase ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}" style="width: 60px;">SLUTAR</th>
                <th class="header-cell px-2 py-2 text-left text-xs font-medium uppercase ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}">BESKRIVNING</th>
              </tr>
            </thead>
            <tbody>
              ${calendarRows}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderCalendarRows(
  startDateStr: string, 
  days: number, 
  events: any[], 
  isDarkMode: boolean, 
  keywordRules: any[], 
  isEditMode: boolean = false,
  holidays: Record<string, string> = {}
) {
  let startDate: Date;
  
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) {
      const [year, month, day] = startDateStr.split('-').map(Number);
      startDate = new Date(year, month - 1, day);
    } else {
      startDate = new Date(startDateStr);
    }
    
    if (isNaN(startDate.getTime())) {
      startDate = new Date();
    }
  } catch (e) {
    startDate = new Date();
  }
  
  const rows: string[] = [];
  
  const eventsByDate: { [key: string]: any[] } = {};
  events.forEach(event => {
    const date = typeof event.start === 'string' ? new Date(event.start) : event.start;
    const dateKey = getLocalDateString(date);
    if (!eventsByDate[dateKey]) {
      eventsByDate[dateKey] = [];
    }
    eventsByDate[dateKey].push(event);
  });
  
  const allDates: Date[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    allDates.push(date);
  }
  
  const arrowRanges: { start: number, end: number, type: string }[] = [];
  
  let bemanningStart: number | null = null;
  for (let idx = 0; idx < allDates.length; idx++) {
    const date = allDates[idx];
    const dateStr = getLocalDateString(date);
    const dayEvents = eventsByDate[dateStr] || [];
    
    for (const event of dayEvents) {
      if (isSpecialEvent(event.summary, ['bemanning start'])) {
        bemanningStart = idx;
      } else if (isSpecialEvent(event.summary, ['bemanning klar']) && bemanningStart !== null) {
        arrowRanges.push({ start: bemanningStart, end: idx, type: 'bemanning' });
        bemanningStart = null;
      }
    }
  }
  
  for (let idx = 0; idx < allDates.length; idx++) {
    const date = allDates[idx];
    const dateStr = getLocalDateString(date);
    const dayEvents = eventsByDate[dateStr] || [];
    
    for (const event of dayEvents) {
      if (isSpecialEvent(event.summary, ['TC schemaspik', 'schemaspik'])) {
        const nextSunday = getNextSunday(date);
        const nextSundayStr = getLocalDateString(nextSunday);
        const endIdx = allDates.findIndex(d => getLocalDateString(d) === nextSundayStr);
        if (endIdx !== -1 && endIdx > idx) {
          arrowRanges.push({ start: idx, end: endIdx, type: 'schemaspik' });
        }
      }
    }
  }
  
  const getArrowState = (idx: number): 'none' | 'start' | 'middle' | 'end' => {
    for (const range of arrowRanges) {
      if (idx === range.start) return 'start';
      if (idx === range.end) return 'end';
      if (idx > range.start && idx < range.end) return 'middle';
    }
    return 'none';
  };
  
  const weekGroups: { weekKey: string, weekNumber: number, year: number, dates: Date[] }[] = [];
  let currentWeekKey = '';
  let currentWeekDates: Date[] = [];
  
  allDates.forEach(date => {
    const weekNumber = getWeekNumber(date);
    const weekKey = `${date.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;
    
    if (weekKey !== currentWeekKey) {
      if (currentWeekDates.length > 0) {
        weekGroups.push({
          weekKey: currentWeekKey,
          weekNumber: getWeekNumber(currentWeekDates[0]),
          year: currentWeekDates[0].getFullYear(),
          dates: currentWeekDates
        });
      }
      currentWeekKey = weekKey;
      currentWeekDates = [date];
    } else {
      currentWeekDates.push(date);
    }
  });
  
  if (currentWeekDates.length > 0) {
    weekGroups.push({
      weekKey: currentWeekKey,
      weekNumber: getWeekNumber(currentWeekDates[0]),
      year: currentWeekDates[0].getFullYear(),
      dates: currentWeekDates
    });
  }
  
  let isFirstWeek = true;
  let globalDateIndex = 0;
  
  weekGroups.forEach((weekGroup) => {
    const weekDates = weekGroup.dates;
    const weekNumber = weekGroup.weekNumber;
    let weekRowCount = 0;
    
    weekDates.forEach(date => {
      const dateKey = getLocalDateString(date);
      const dayEvents = eventsByDate[dateKey] || [];
      weekRowCount += Math.max(1, dayEvents.length);
    });
    
    let isFirstRowOfWeek = true;
    
    weekDates.forEach((date, dateIdx) => {
      const dateKey = getLocalDateString(date);
      const dayEvents = eventsByDate[dateKey] || [];
      const weekDays = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
      const dayName = weekDays[date.getDay()];
      const isRedDay = date.getDay() === 0 || date.getDay() === 6;
      
      const isHolidayDate = holidays[dateKey] !== undefined;
      const holidayName = holidays[dateKey] || '';
      
      const isFirstDayOfWeek = dateIdx === 0;
      const arrowState = getArrowState(globalDateIndex);
      
      let borderClass = '';
      if (!isFirstWeek && isFirstDayOfWeek) {
        borderClass = 'week-separator';
      } else if (dateIdx > 0) {
        borderClass = 'row-border';
      }
      
      let arrowCellClass = 'arrow-cell';
      if (!isFirstWeek && isFirstDayOfWeek) {
        arrowCellClass += ' week-separator';
      }
      
      if (dayEvents.length === 0) {
        rows.push(`
          <tr class="${borderClass}">
            ${isEditMode ? `<td class="px-2 py-2 text-center"></td>` : ''}
            ${isFirstRowOfWeek ? `
              <td rowspan="${weekRowCount}" class="week-cell px-2 py-2 text-xs" style="border-right: 1px solid ${isDarkMode ? '#6b7280' : '#9ca3af'} !important;">
                ${String(weekNumber).padStart(2, '0')}
              </td>
            ` : ''}
            <td class="px-3 py-2 text-xs">${date.toLocaleDateString('sv-SE')}</td>
            <td class="px-3 py-2 text-xs ${isRedDay || isHolidayDate ? 'holiday-text' : ''}" title="${holidayName}">${dayName}</td>
            <td class="${arrowCellClass}" rowspan="1">
              ${arrowState !== 'none' ? `<div class="arrow-line${arrowState === 'start' ? ' arrow-start' : ''}${arrowState === 'end' ? ' arrow-end' : ''}"></div>` : ''}
            </td>
            <td class="px-2 py-1 text-xs text-gray-500">-</td>
            <td class="px-2 py-1 text-xs">-</td>
            <td class="px-2 py-1 text-xs">-</td>
            <td class="px-3 py-1 text-xs">-</td>
          </tr>
        `);
        isFirstRowOfWeek = false;
      } else {
        dayEvents.forEach((event: any, eventIdx: number) => {
          const eventDate = typeof event.start === 'string' ? new Date(event.start) : event.start;
          const endDate = event.end ? (typeof event.end === 'string' ? new Date(event.end) : event.end) : eventDate;
          const eventColor = getEventColor(event.summary, keywordRules);
          const isWholeDay = eventDate.getHours() === 0 && eventDate.getMinutes() === 0 && 
                             endDate.getHours() === 0 && endDate.getMinutes() === 0 &&
                             endDate.getDate() !== eventDate.getDate();
          
          const isFirstEventOfDay = eventIdx === 0;
          
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
                <td rowspan="${weekRowCount}" class="week-cell px-2 py-2 text-xs" style="border-right: 1px solid ${isDarkMode ? '#6b7280' : '#9ca3af'} !important;">
                  ${String(weekNumber).padStart(2, '0')}
                </td>
              ` : ''}
              ${isFirstEventOfDay ? `
                <td rowspan="${dayEvents.length}" class="px-3 py-1 text-xs">${date.toLocaleDateString('sv-SE')}</td>
                <td rowspan="${dayEvents.length}" class="px-3 py-1 text-xs ${isRedDay || isHolidayDate ? 'holiday-text' : ''}" title="${holidayName}">${dayName}</td>
                <td rowspan="${dayEvents.length}" class="${arrowCellClass}">
                  ${arrowState !== 'none' ? `<div class="arrow-line${arrowState === 'start' ? ' arrow-start' : ''}${arrowState === 'end' ? ' arrow-end' : ''}"></div>` : ''}
                </td>
              ` : ''}
              <td class="px-2 py-1">
                <div class="flex items-center gap-2">
                  <span class="inline-block px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap" style="background-color: ${eventColor.bg}; color: ${eventColor.text}">
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
              <td class="px-2 py-1 text-xs">
                ${isWholeDay ? 'Heldag' : eventDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
              </td>
              <td class="px-2 py-1 text-xs">
                ${isWholeDay ? 'Heldag' : endDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
              </td>
              <td class="px-3 py-1 text-xs">${event.description || '-'}</td>
            </tr>
          `);
          isFirstRowOfWeek = false;
        });
      }
      
      globalDateIndex++;
    });
    
    isFirstWeek = false;
  });
  
  if (rows.length === 0) {
    rows.push(`
      <tr>
        <td colspan="${isEditMode ? '9' : '8'}" class="px-4 py-12 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}">
          Inga händelser att visa
        </td>
      </tr>
    `);
  }
  
  return rows.join('');
}
