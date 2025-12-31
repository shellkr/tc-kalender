export function renderListView(session: any) {
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
  const today = new Date().toISOString().split('T')[0];

  return `
    <div class="space-y-6">
      <div class="rounded-lg shadow-sm border p-4 ${cardClasses}">
        <div class="flex flex-wrap gap-4 items-center justify-between">
          <div class="flex items-center gap-2">
            <label class="text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-700'}">Från datum:</label>
            <input
              type="date"
              name="start_date"
              value="${today}"
              hx-get="/view/calendar/list"
              hx-trigger="change"
              hx-target="#calendar-content"
              class="px-3 py-2 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}"
            />
          </div>
          <div class="flex gap-2">
            <button
              class="flex items-center gap-2 px-4 py-2 ${isDarkMode ? 'bg-orange-600 hover:bg-orange-700' : 'bg-orange-600 hover:bg-orange-700'} text-white rounded-lg transition-colors"
            >
              ✏️ Redigera
            </button>
            <button
              onclick="window.print()"
              class="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              🖨️ Skriv ut
            </button>
          </div>
        </div>
      </div>

      <div class="rounded-lg shadow-sm border overflow-hidden ${cardClasses}">
        <div class="overflow-x-auto">
          <table class="w-full text-sm border-collapse">
            <thead class="${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}">
              <tr>
                <th class="px-2 py-2 text-center text-xs font-medium uppercase w-12 border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}">V</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase w-28 border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}">DATUM</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase w-24 border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}">DAG</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}">HÄNDELSE</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase w-20 border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}">BÖRJAR</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase w-20 border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}">SLUTAR</th>
                <th class="px-3 py-2 text-left text-xs font-medium uppercase border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}">BESKRIVNING</th>
                <th class="px-2 py-2 text-center text-xs font-medium uppercase w-20 border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}">ÅTGÄRD</th>
              </tr>
            </thead>
            <tbody>
              ${renderCalendarRows(today, 365, filteredEvents, isDarkMode, session.settings?.keywordRules || [])}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function renderCalendarRows(startDateStr: string, days: number, events: any[], isDarkMode: boolean, keywordRules: any[]) {
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
  weeks.forEach((weekKey, weekIdx) => {
    const weekDates = weekGroups[weekKey];
    const weekNumber = getWeekNumber(weekDates[0]);
    let weekRowCount = 0;
    
    // Count total rows for this week
    weekDates.forEach(date => {
      const dateKey = date.toISOString().split('T')[0];
      const dayEvents = eventsByDate[dateKey] || [];
      weekRowCount += Math.max(1, dayEvents.length);
    });
    
    // Track if we've added the week number cell
    let isFirstRowOfWeek = true;
    
    weekDates.forEach((date, dateIdx) => {
      const dateKey = date.toISOString().split('T')[0];
      const dayEvents = eventsByDate[dateKey] || [];
      const weekDays = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
      const dayName = weekDays[date.getDay()];
      const isRedDay = date.getDay() === 0 || date.getDay() === 6;
      
      const isFirstDayOfWeek = dateIdx === 0;
      const borderClass = (weekIdx > 0 && isFirstDayOfWeek) ? 'border-t-2' : 'border-t';
      const borderColor = (weekIdx > 0 && isFirstDayOfWeek)
        ? (isDarkMode ? 'border-gray-500' : 'border-gray-400')
        : (isDarkMode ? 'border-gray-700' : 'border-gray-200');
      
      if (dayEvents.length === 0) {
        // No events for this day
        rows.push(`
          <tr class="${borderClass} ${borderColor}">
            ${isFirstRowOfWeek ? `
              <td rowspan="${weekRowCount}" class="px-2 py-2 text-center text-xs font-medium ${isDarkMode ? 'bg-gray-750 text-gray-400' : 'bg-gray-100 text-gray-600'}">
                ${String(weekNumber).padStart(2, '0')}
              </td>
            ` : ''}
            <td class="px-3 py-2 text-xs">${date.toLocaleDateString('sv-SE')}</td>
            <td class="px-3 py-2 text-xs ${isRedDay ? 'text-red-600 font-bold' : ''}">${dayName}</td>
            <td class="px-3 py-2 text-xs text-gray-500">-</td>
            <td class="px-3 py-2 text-xs">-</td>
            <td class="px-3 py-2 text-xs">-</td>
            <td class="px-3 py-2 text-xs">-</td>
            <td class="px-2 py-2 text-center"></td>
          </tr>
        `);
        isFirstRowOfWeek = false;
      } else {
        // Has events - one row per event
        dayEvents.forEach((event: any, eventIdx: number) => {
          const endDate = event.end ? (typeof event.end === 'string' ? new Date(event.end) : event.end) : date;
          const eventColor = getEventColor(event.summary, keywordRules);
          const isWholeDay = date.getHours() === 0 && date.getMinutes() === 0 && 
                             endDate.getHours() === 0 && endDate.getMinutes() === 0 &&
                             endDate.getDate() !== date.getDate();
          
          const isFirstEventOfDay = eventIdx === 0;
          
          rows.push(`
            <tr class="${borderClass} ${borderColor}">
              ${isFirstRowOfWeek ? `
                <td rowspan="${weekRowCount}" class="px-2 py-2 text-center text-xs font-medium ${isDarkMode ? 'bg-gray-750 text-gray-400' : 'bg-gray-100 text-gray-600'}">
                  ${String(weekNumber).padStart(2, '0')}
                </td>
              ` : ''}
              ${isFirstEventOfDay ? `
                <td rowspan="${dayEvents.length}" class="px-3 py-2 text-xs">${date.toLocaleDateString('sv-SE')}</td>
                <td rowspan="${dayEvents.length}" class="px-3 py-2 text-xs ${isRedDay ? 'text-red-600 font-bold' : ''}">${dayName}</td>
              ` : ''}
              <td class="px-3 py-2">
                <span class="inline-block px-2 py-1 rounded text-xs font-medium" style="background-color: ${eventColor.bg}; color: ${eventColor.text}">
                  ${event.summary}
                </span>
              </td>
              <td class="px-3 py-2 text-xs">
                ${isWholeDay ? 'Heldag' : date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
              </td>
              <td class="px-3 py-2 text-xs">
                ${isWholeDay ? 'Heldag' : endDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
              </td>
              <td class="px-3 py-2 text-xs">${event.description || '-'}</td>
              <td class="px-2 py-2 text-center">
                <button
                  hx-delete="/event/${event.id}"
                  hx-confirm="Är du säker?"
                  hx-target="closest tr"
                  hx-swap="outerHTML swap:0.5s"
                  class="p-1 text-red-600 hover:bg-red-100 rounded"
                >
                  🗑️
                </button>
              </td>
            </tr>
          `);
          isFirstRowOfWeek = false;
        });
      }
    });
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
