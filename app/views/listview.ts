// views/listview.ts - Complete list view with smart background refresh
// FIXED:
//   1. Redigera button passes skipCheck=true so toggling edit mode does NOT
//      immediately trigger a background check that would kick the user out.
//   2. Background-check URL carries editMode so changes detected while in edit
//      mode reload in edit mode instead of resetting to read-only.

import { getDisplaySummary } from '../utils/helpers';

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

export function renderListView(
  session: any,
  startDate?: string,
  isEditMode: boolean = false,
  skipCheck: boolean = false
) {
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

  const calendarRows = renderCalendarRows(
    selectedDate, 365, filteredEvents, isDarkMode,
    session.settings?.keywordRules || [], isEditMode, holidays
  );

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
        width: 10px; min-width: 10px; max-width: 10px;
        padding: 0 !important; margin: 0 !important;
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
        position: absolute; left: 56%; top: 0; bottom: 0; width: 0;
        border-left: 2px solid #dc2626; transform: translateX(-60%);
      }
      .arrow-line.arrow-end::before {
        content: ''; position: absolute; bottom: -1px; left: 50%;
        transform: translateX(-60%); width: 0; height: 0;
        border-left: 5px solid transparent; border-right: 5px solid transparent;
        border-top: 6px solid #dc2626;
      }
      .arrow-line.arrow-start::after {
        content: ''; position: absolute; top: -1px; left: 50%;
        transform: translateX(-60%); width: 6px; height: 6px;
        background-color: #dc2626; border-radius: 50%;
      }
      .calendar-table td:not(.week-cell):not(.arrow-cell) {
        border-left: 1px solid ${isDarkMode ? '#374151' : '#e5e7eb'};
      }
      .week-separator { border-top: 2px solid ${isDarkMode ? '#6b7280' : '#4b5563'} !important; }
      .row-border    { border-top: 1px solid ${isDarkMode ? '#374151' : '#e5e7eb'} !important; }
      .same-day-event { border-top: none !important; }
      .calendar-table td { border: none !important; }
      .header-cell { border-bottom: 2px solid ${isDarkMode ? '#4b5563' : '#d1d5db'} !important; }
      .holiday-text { color: #dc2626 !important; font-weight: bold; }
      .icon-button { transition: all 0.2s ease-in-out; }
      .icon-button:hover { transform: translateY(-1px); }
      .icon-button:active { transform: translateY(0); }
    </style>

    <div class="space-y-6">
      <div class="rounded-lg shadow-sm border p-4 ${cardClasses}">
        <div class="flex flex-wrap gap-4 items-center justify-between">

          <!-- Date picker -->
          <div class="flex flex-wrap items-center gap-2">
            <label class="text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-700'} flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Från datum:
            </label>
            <input
              type="date"
              id="date-picker"
              value="${selectedDate}"
              class="px-3 py-2 border rounded ${isDarkMode
                ? 'bg-gray-700 border-gray-600 text-white'
                : 'bg-white border-gray-300 text-gray-900'} text-sm"
            />
            <button
              id="today-btn"
              class="icon-button px-3 py-2 text-sm rounded border ${isDarkMode
                ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}"
            >
              Idag
            </button>
            <script>
              (function() {
                var picker  = document.getElementById('date-picker');
                var todayBtn = document.getElementById('today-btn');

                if (picker) {
                  picker.addEventListener('change', function() {
                    var newDate = picker.value;
                    sessionStorage.setItem('tcapp_selected_date', newDate);
                    if (newDate && /^\\d{4}-\\d{2}-\\d{2}$/.test(newDate)) {
                      htmx.ajax('GET',
                        '/view/calendar/list?date=' + newDate + '&editMode=${isEditMode}',
                        { target: '#calendar-content', swap: 'innerHTML' });
                    }
                  });
                }

                if (todayBtn) {
                  todayBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    var today = new Date();
                    var yyyy = today.getFullYear();
                    var mm = String(today.getMonth() + 1).padStart(2, '0');
                    var dd = String(today.getDate()).padStart(2, '0');
                    var todayStr = yyyy + '-' + mm + '-' + dd;
                    if (picker) picker.value = todayStr;
                    sessionStorage.setItem('tcapp_selected_date', todayStr);
                    htmx.ajax('GET',
                      '/view/calendar/list?date=' + todayStr + '&editMode=false',
                      { target: '#calendar-content', swap: 'innerHTML' });
                  });
                }
              })();
            </script>
          </div>

          <!-- Action buttons -->
          <div class="flex gap-2">
            <!-- Refresh button -->
            <button
              hx-post="/calendar/refresh"
              hx-target="#refresh-result"
              hx-swap="innerHTML"
              class="group icon-button flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-sm hover:shadow-md"
              title="Hämta nya händelser från kalendrar"
            >
              <svg class="w-4 h-4 group-hover:rotate-180 transition-transform duration-500"
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0
                     0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span class="font-medium text-sm">Uppdatera</span>
            </button>

            <!--
              REDIGERA / AVSLUTA REDIGERING BUTTON
              FIX 1: skipCheck=true prevents the background-check from firing
                      immediately after entering edit mode and kicking the user out.
              FIX 2: When EXITING edit mode we do NOT add skipCheck so the
                      background check can run normally again.
            -->
            <button
              hx-get="/view/calendar/list?date=${selectedDate}&editMode=${!isEditMode}${isEditMode ? '' : '&skipCheck=true'}"
              hx-target="#calendar-content"
              hx-swap="innerHTML"
              class="icon-button flex items-center gap-2 px-4 py-2
                ${isEditMode
                  ? 'bg-gray-600 hover:bg-gray-700'
                  : 'bg-orange-600 hover:bg-orange-700'}
                text-white rounded-lg transition-all shadow-sm hover:shadow-md"
            >
              ${isEditMode ? `
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span class="font-medium">Avsluta redigering</span>
              ` : `
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5
                       m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <span class="font-medium">Redigera</span>
              `}
            </button>

            <!-- Print button -->
            <button
              onclick="window.open('/view/calendar/print?date=${selectedDate}', '_blank')"
              ${isEditMode ? 'disabled' : ''}
              class="icon-button flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700
                text-white rounded-lg transition-all shadow-sm hover:shadow-md
                ${isEditMode ? 'opacity-50 cursor-not-allowed' : ''}"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                  d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2
                     m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2z
                     m8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span class="font-medium">Skriv ut</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Refresh result -->
      <div id="refresh-result" class="mt-2"></div>

      <!--
        BACKGROUND CALENDAR CHECKER
        FIX: Only shown when skipCheck=false AND not in edit mode.
             Edit mode always suppresses the background check (skipCheck=true
             is set by the Redigera button above).
             Also passes editMode to the server so that if changes ARE detected,
             the reloaded view preserves the current edit-mode state.
      -->
      ${!skipCheck && !isEditMode ? `
        <div
          id="calendar-checker"
          hx-get="/calendar/background-check?currentView=list&date=${selectedDate}&editMode=${isEditMode}"
          hx-trigger="load delay:500ms"
          hx-swap="outerHTML"
          class="fixed bottom-4 right-4
            ${isDarkMode
              ? 'bg-gray-800 border-gray-700 text-gray-300'
              : 'bg-white border-gray-200 text-gray-700'}
            rounded-lg shadow-lg px-4 py-2 flex items-center gap-2 border"
        >
          <div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span class="text-sm">Kontrollerar kalendrar...</span>
        </div>
      ` : ''}

      <!-- Edit mode toolbar -->
      ${isEditMode ? `
        <div class="rounded-lg shadow-sm border p-4 ${cardClasses}">
          <div class="flex flex-wrap gap-2 items-center justify-between">
            <div class="flex items-center gap-2">
              <span id="selected-count" class="text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}">
                0 markerade
              </span>
            </div>
            <div class="flex gap-2">
              <button
                onclick="toggleAllCheckboxes()"
                class="px-3 py-1.5 text-sm rounded border
                  ${isDarkMode
                    ? 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}"
              >
                Markera alla
              </button>
              <button
                onclick="deleteSelectedEvents()"
                class="px-3 py-1.5 text-sm rounded bg-red-600 hover:bg-red-700 text-white"
              >
                Ta bort markerade
              </button>
            </div>
          </div>
        </div>

        <script>
          function updateSelectedCount() {
            var checkboxes = document.querySelectorAll('.event-checkbox:checked');
            var countEl = document.getElementById('selected-count');
            if (countEl) countEl.textContent = checkboxes.length + ' markerade';
          }

          function toggleAllCheckboxes() {
            var checkboxes = document.querySelectorAll('.event-checkbox');
            var selectAllCheckbox = document.getElementById('select-all-checkbox');
            var shouldCheck = selectAllCheckbox ? !selectAllCheckbox.checked : true;
            checkboxes.forEach(function(cb) { cb.checked = shouldCheck; });
            if (selectAllCheckbox) selectAllCheckbox.checked = shouldCheck;
            updateSelectedCount();
          }

          function deleteSelectedEvents() {
            var checkboxes = document.querySelectorAll('.event-checkbox:checked');
            if (checkboxes.length === 0) { alert('Inga händelser markerade'); return; }
            if (!confirm('Är du säker på att du vill ta bort ' + checkboxes.length + ' händelse(r)?')) return;

            var eventIds = Array.from(checkboxes).map(function(cb) { return cb.value; });

            var deletePromises = eventIds.map(function(id) {
              return fetch('/event/' + id, { method: 'DELETE' });
            });

            Promise.all(deletePromises).then(function() {
              var dateInput = document.getElementById('date-picker');
              var currentDate = dateInput ? dateInput.value : '${selectedDate}';
              htmx.ajax('GET',
                '/view/calendar/list?date=' + currentDate + '&editMode=true&skipCheck=true',
                { target: '#calendar-content', swap: 'innerHTML' });
            });
          }

          updateSelectedCount();
        </script>
      ` : ''}

      <!-- Calendar table -->
      <div class="rounded-lg shadow-sm border overflow-hidden ${cardClasses}">
        <div class="overflow-x-auto">
          <table class="calendar-table w-full text-sm border-collapse">
            <thead class="${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}">
              <tr>
                ${isEditMode ? `
                  <th class="header-cell px-2 py-2 text-center text-xs font-medium uppercase w-12
                    ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}">
                    <input type="checkbox" id="select-all-checkbox"
                      onclick="toggleAllCheckboxes()" class="w-4 h-4 text-blue-600 rounded" />
                  </th>
                ` : ''}
                <th class="header-cell px-2 py-2 text-center text-xs font-medium uppercase
                  ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}" style="width:30px;">V</th>
                <th class="header-cell px-3 py-2 text-left text-xs font-medium uppercase
                  ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}" style="width:60px;">DATUM</th>
                <th class="header-cell px-3 py-2 text-left text-xs font-medium uppercase
                  ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}" style="width:60px;">DAG</th>
                <th class="header-cell px-0 py-2 text-center text-xs font-medium uppercase
                  ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}"
                  style="width:10px;min-width:10px;max-width:10px;padding:0.375rem 0;"></th>
                <th class="header-cell px-2 py-2 text-left text-xs font-medium uppercase
                  ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}" style="width:60px;">HÄNDELSE</th>
                <th class="header-cell px-2 py-2 text-left text-xs font-medium uppercase
                  ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}" style="width:60px;">BÖRJAR</th>
                <th class="header-cell px-2 py-2 text-left text-xs font-medium uppercase
                  ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}" style="width:60px;">SLUTAR</th>
                <th class="header-cell px-2 py-2 text-left text-xs font-medium uppercase
                  ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}">BESKRIVNING</th>
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

// ---------------------------------------------------------------------------
// renderCalendarRows
// ---------------------------------------------------------------------------
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
    if (isNaN(startDate.getTime())) startDate = new Date();
  } catch {
    startDate = new Date();
  }

  // Index events by local date string
  const eventsByDate: Record<string, any[]> = {};
  events.forEach(event => {
    const date = typeof event.start === 'string' ? new Date(event.start) : event.start;
    const key = getLocalDateString(date);
    if (!eventsByDate[key]) eventsByDate[key] = [];
    eventsByDate[key].push(event);
  });

  // Build date array
  const allDates: Date[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    allDates.push(d);
  }

  // Build arrow ranges (bemanning + schemaspik)
  const arrowRanges: { start: number; end: number; type: string }[] = [];
  let bemanningStart: number | null = null;

  allDates.forEach((date, idx) => {
    const dayEvents = eventsByDate[getLocalDateString(date)] || [];
    for (const event of dayEvents) {
      if (isSpecialEvent(event.summary, ['bemanning start'])) {
        bemanningStart = idx;
      } else if (isSpecialEvent(event.summary, ['bemanning klar']) && bemanningStart !== null) {
        arrowRanges.push({ start: bemanningStart, end: idx, type: 'bemanning' });
        bemanningStart = null;
      }
    }
  });

  allDates.forEach((date, idx) => {
    const dayEvents = eventsByDate[getLocalDateString(date)] || [];
    for (const event of dayEvents) {
      if (isSpecialEvent(event.summary, ['TC schemaspik', 'schemaspik'])) {
        const nextSunday = getNextSunday(date);
        const endIdx = allDates.findIndex(d => getLocalDateString(d) === getLocalDateString(nextSunday));
        if (endIdx !== -1 && endIdx > idx) {
          arrowRanges.push({ start: idx, end: endIdx, type: 'schemaspik' });
        }
      }
    }
  });

  const getArrowState = (idx: number): 'none' | 'start' | 'middle' | 'end' => {
    for (const range of arrowRanges) {
      if (idx === range.start) return 'start';
      if (idx === range.end) return 'end';
      if (idx > range.start && idx < range.end) return 'middle';
    }
    return 'none';
  };

  // Group dates into ISO weeks
  const weekGroups: { weekKey: string; weekNumber: number; dates: Date[] }[] = [];
  let currentWeekKey = '';
  let currentWeekDates: Date[] = [];

  allDates.forEach(date => {
    const wn = getWeekNumber(date);
    const wk = `${date.getFullYear()}-W${String(wn).padStart(2, '0')}`;
    if (wk !== currentWeekKey) {
      if (currentWeekDates.length > 0) {
        weekGroups.push({
          weekKey: currentWeekKey,
          weekNumber: getWeekNumber(currentWeekDates[0]),
          dates: currentWeekDates
        });
      }
      currentWeekKey = wk;
      currentWeekDates = [date];
    } else {
      currentWeekDates.push(date);
    }
  });
  if (currentWeekDates.length > 0) {
    weekGroups.push({
      weekKey: currentWeekKey,
      weekNumber: getWeekNumber(currentWeekDates[0]),
      dates: currentWeekDates
    });
  }

  const weekDays = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
  const rows: string[] = [];
  let isFirstWeek = true;
  let globalDateIndex = 0;

  weekGroups.forEach(weekGroup => {
    const { weekNumber, dates } = weekGroup;

    // Pre-compute week row count (sum of max(1, events) per day)
    let weekRowCount = 0;
    dates.forEach(date => {
      const dayEvents = eventsByDate[getLocalDateString(date)] || [];
      weekRowCount += Math.max(1, dayEvents.length);
    });

    let isFirstRowOfWeek = true;

    dates.forEach((date, dateIdx) => {
      const dateKey = getLocalDateString(date);
      const dayEvents = eventsByDate[dateKey] || [];
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
      if (!isFirstWeek && isFirstDayOfWeek) arrowCellClass += ' week-separator';

      if (dayEvents.length === 0) {
        rows.push(`
          <tr class="${borderClass}">
            ${isEditMode ? `<td class="px-2 py-2 text-center"></td>` : ''}
            ${isFirstRowOfWeek ? `
              <td rowspan="${weekRowCount}" class="week-cell px-2 py-2 text-xs"
                style="border-right:1px solid ${isDarkMode ? '#6b7280' : '#9ca3af'} !important;">
                ${String(weekNumber).padStart(2, '0')}
              </td>
            ` : ''}
            <td class="px-3 py-2 text-xs">${date.toLocaleDateString('sv-SE')}</td>
            <td class="px-3 py-2 text-xs ${isRedDay || isHolidayDate ? 'holiday-text' : ''}"
              title="${holidayName}">${dayName}</td>
            <td class="${arrowCellClass}" rowspan="1">
              ${arrowState !== 'none'
                ? `<div class="arrow-line${arrowState === 'start' ? ' arrow-start' : ''}${arrowState === 'end' ? ' arrow-end' : ''}"></div>`
                : ''}
            </td>
            <td class="px-2 py-1 text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}">-</td>
            <td class="px-2 py-1 text-xs">-</td>
            <td class="px-2 py-1 text-xs">-</td>
            <td class="px-3 py-1 text-xs">-</td>
          </tr>
        `);
        isFirstRowOfWeek = false;
      } else {
        dayEvents.forEach((event: any, eventIdx: number) => {
          const eventDate = typeof event.start === 'string' ? new Date(event.start) : event.start;
          const endDate = event.end
            ? (typeof event.end === 'string' ? new Date(event.end) : event.end)
            : eventDate;
          const eventColor = getEventColor(event.summary, keywordRules);
          const isWholeDay =
            eventDate.getHours() === 0 && eventDate.getMinutes() === 0 &&
            endDate.getHours() === 0 && endDate.getMinutes() === 0 &&
            endDate.getDate() !== eventDate.getDate();
          const isFirstEventOfDay = eventIdx === 0;
          const eventBorderClass = isFirstEventOfDay ? borderClass : 'same-day-event';

          const startTimeStr = isWholeDay
            ? '(Heldag)'
            : eventDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
          const endTimeStr = isWholeDay
            ? ''
            : (endDate && endDate.getTime() !== eventDate.getTime()
              ? endDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
              : '');

          rows.push(`
            <tr class="${eventBorderClass}">
              ${isEditMode ? `
                <td class="px-2 py-2 text-center">
                  <input type="checkbox" class="event-checkbox w-4 h-4 text-blue-600 rounded"
                    value="${event.id}" onchange="updateSelectedCount()" />
                </td>
              ` : ''}
              ${isFirstRowOfWeek ? `
                <td rowspan="${weekRowCount}" class="week-cell px-2 py-2 text-xs"
                  style="border-right:1px solid ${isDarkMode ? '#6b7280' : '#9ca3af'} !important;">
                  ${String(weekNumber).padStart(2, '0')}
                </td>
              ` : ''}
              ${isFirstEventOfDay ? `
                <td rowspan="${dayEvents.length}" class="px-3 py-1 text-xs">
                  ${date.toLocaleDateString('sv-SE')}
                </td>
                <td rowspan="${dayEvents.length}"
                  class="px-3 py-1 text-xs ${isRedDay || isHolidayDate ? 'holiday-text' : ''}"
                  title="${holidayName}">${dayName}</td>
                <td rowspan="${dayEvents.length}" class="${arrowCellClass}">
                  ${arrowState !== 'none'
                    ? `<div class="arrow-line${arrowState === 'start' ? ' arrow-start' : ''}${arrowState === 'end' ? ' arrow-end' : ''}"></div>`
                    : ''}
                </td>
              ` : ''}
              <td class="px-2 py-1">
                <div class="flex items-center gap-2">
                  <span class="inline-block px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap" style="background-color: ${eventColor.bg}; color: ${eventColor.text}" title="${event.summary}">
                    ${getDisplaySummary(event.summary)}
                  </span>
                </div>
              </td>
              <td class="px-2 py-1 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} whitespace-nowrap">
                ${startTimeStr}
              </td>
              <td class="px-2 py-1 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} whitespace-nowrap">
                ${endTimeStr}
              </td>
              <td class="px-3 py-1 text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}">
                ${event.description ? event.description.substring(0, 80) + (event.description.length > 80 ? '…' : '') : ''}
              </td>
            </tr>
          `);
          isFirstRowOfWeek = false;
        });
      }

      globalDateIndex++;
    });

    isFirstWeek = false;
  });

  return rows.join('');
}
