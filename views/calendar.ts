export function renderCalendarView(session: any) {
  const isDarkMode = session.settings?.darkMode || false;
  const events = session.events || [];
  const profiles = session.settings?.profiles || [];
  const activeProfileId = session.settings?.activeProfileId || 'default';
  const activeProfile = profiles.find((p: any) => p.id === activeProfileId);
  const visibleCalendarIds = activeProfile?.calendarIds || [];
  
  const filteredEvents = events.filter((e: any) => 
    !e.calendarId || visibleCalendarIds.includes(e.calendarId)
  );

  const cardClasses = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';

  return `
    <div>
      <div class="mb-6 flex items-center justify-between">
        <h2 class="text-2xl font-bold">Mina händelser</h2>
        <div class="flex gap-2">
          <button
            hx-get="/view/calendar/list"
            hx-target="#calendar-content"
            class="px-4 py-2 rounded-lg flex items-center gap-2 ${isDarkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}"
          >
            📋 Lista
          </button>
          <button
            hx-get="/view/calendar/month"
            hx-target="#calendar-content"
            class="px-4 py-2 rounded-lg flex items-center gap-2 ${isDarkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}"
          >
            📅 Månad
          </button>
        </div>
      </div>

      <div id="calendar-content" hx-get="/view/calendar/list" hx-trigger="load" hx-swap="innerHTML">
        <div class="text-center py-12">Laddar kalender...</div>
      </div>
    </div>
  `;
}

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
    .sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime());

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
              class="px-3 py-1 border rounded ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}"
            />
          </div>
          <button
            hx-get="/view/calendar/print"
            hx-target="#print-preview"
            class="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            🖨️ Skriv ut
          </button>
        </div>
      </div>

      <div class="rounded-lg shadow-sm border overflow-hidden ${cardClasses}">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}">
              <tr>
                <th class="px-2 py-1.5 text-center text-xs font-medium uppercase w-8 border-b ${isDarkMode ? 'border-gray-400' : 'border-gray-300'}">V</th>
                <th class="px-2 py-1.5 text-left text-xs font-medium uppercase w-20 border-b ${isDarkMode ? 'border-gray-400' : 'border-gray-300'}">Datum</th>
                <th class="px-2 py-1.5 text-left text-xs font-medium uppercase w-16 border-b ${isDarkMode ? 'border-gray-400' : 'border-gray-300'}">Dag</th>
                <th class="px-2 py-1.5 text-left text-xs font-medium uppercase w-28 border-b ${isDarkMode ? 'border-gray-400' : 'border-gray-300'}">Händelse</th>
                <th class="px-2 py-1.5 text-left text-xs font-medium uppercase w-12 border-b ${isDarkMode ? 'border-gray-400' : 'border-gray-300'}">Börjar</th>
                <th class="px-2 py-1.5 text-left text-xs font-medium uppercase w-12 border-b ${isDarkMode ? 'border-gray-400' : 'border-gray-300'}">Slutar</th>
                <th class="px-2 py-1.5 text-left text-xs font-medium uppercase border-b ${isDarkMode ? 'border-gray-400' : 'border-gray-300'}">Beskrivning</th>
                <th class="px-2 py-1.5 text-center text-xs font-medium uppercase w-16 border-b ${isDarkMode ? 'border-gray-400' : 'border-gray-300'}">Åtgärd</th>
              </tr>
            </thead>
            <tbody>
              ${filteredEvents.length === 0 ? `
                <tr>
                  <td colspan="8" class="px-4 py-12 text-center ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}">
                    Inga händelser att visa
                  </td>
                </tr>
              ` : filteredEvents.map((event: any) => {
                const date = new Date(event.start);
                const endDate = event.end ? new Date(event.end) : date;
                const weekDays = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
                const dayName = weekDays[date.getDay()];
                
                const weekNumber = getWeekNumber(date);
                
                const eventColor = getEventColor(event.summary, session.settings?.keywordRules || []);
                
                const isWholeDay = date.getHours() === 0 && date.getMinutes() === 0 && 
                                   endDate.getHours() === 0 && endDate.getMinutes() === 0 &&
                                   endDate.getDate() !== date.getDate();

                return `
                  <tr class="border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}">
                    <td class="px-2 py-2 text-center text-xs">${String(weekNumber).padStart(2, '0')}</td>
                    <td class="px-2 py-2 text-xs">${date.toLocaleDateString('sv-SE')}</td>
                    <td class="px-2 py-2 text-xs">${dayName}</td>
                    <td class="px-2 py-2">
                      <span class="px-2 py-0.5 rounded text-xs font-medium" style="background-color: ${eventColor.bg}; color: ${eventColor.text}">
                        ${event.summary}
                      </span>
                    </td>
                    <td class="px-2 py-2 text-xs">${isWholeDay ? 'Heldag' : date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td class="px-2 py-2 text-xs">${isWholeDay ? 'Heldag' : endDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td class="px-2 py-2 text-xs">${event.description || '-'}</td>
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
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    <div id="print-preview"></div>
  `;
}

export function renderMonthView(session: any) {
  const isDarkMode = session.settings?.darkMode || false;
  const events = session.events || [];
  const profiles = session.settings?.profiles || [];
  const activeProfileId = session.settings?.activeProfileId || 'default';
  const activeProfile = profiles.find((p: any) => p.id === activeProfileId);
  const visibleCalendarIds = activeProfile?.calendarIds || [];
  
  const filteredEvents = events.filter((e: any) => 
    !e.calendarId || visibleCalendarIds.includes(e.calendarId)
  );

  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const monthNames = ['Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni', 'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];
  const dayNames = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = (firstDay.getDay() + 6) % 7;

  const cardClasses = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';

  let calendarHtml = `
    <div class="rounded-lg shadow-sm border overflow-hidden ${cardClasses}">
      <div class="px-4 py-3 border-b flex items-center justify-between ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'}">
        <button
          hx-get="/view/calendar/month?offset=-1"
          hx-target="#calendar-content"
          class="p-2 rounded hover:bg-opacity-50 ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}"
        >
          ◀
        </button>
        <h3 class="text-lg font-semibold">${monthNames[month]} ${year}</h3>
        <button
          hx-get="/view/calendar/month?offset=1"
          hx-target="#calendar-content"
          class="p-2 rounded hover:bg-opacity-50 ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}"
        >
          ▶
        </button>
      </div>
      
      <div class="grid grid-cols-7 gap-0">
        ${dayNames.map(day => `
          <div class="px-2 py-2 text-center text-sm font-medium border-b border-r ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'}">
            ${day}
          </div>
        `).join('')}
  `;

  for (let i = 0; i < startDayOfWeek; i++) {
    calendarHtml += `<div class="min-h-24 p-2 border-b border-r ${isDarkMode ? 'border-gray-600 bg-gray-800 text-gray-500' : 'border-gray-200 bg-gray-50 text-gray-400'}"></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    const dayEvents = filteredEvents.filter((e: any) => {
      const eventDate = new Date(e.start);
      const eventDateStr = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`;
      return eventDateStr === dateStr;
    });

    const isToday = date.toDateString() === new Date().toDateString();

    calendarHtml += `
      <div class="min-h-24 p-2 border-b border-r flex flex-col ${isDarkMode ? 'border-gray-600' : 'border-gray-200'} ${isToday ? (isDarkMode ? 'bg-blue-900' : 'bg-blue-50') : ''}">
        <div class="text-sm font-medium mb-1 ${isToday ? 'text-blue-600 font-bold' : ''}">${day}</div>
        <div class="flex-1 space-y-1">
          ${dayEvents.map((event: any) => {
            const eventColor = getEventColor(event.summary, session.settings?.keywordRules || []);
            return `
              <div class="text-xs px-1 py-0.5 rounded overflow-hidden" style="background-color: ${eventColor.bg}; color: ${eventColor.text}" title="${event.summary}">
                ${event.summary}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  calendarHtml += `
      </div>
    </div>
  `;

  return calendarHtml;
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
