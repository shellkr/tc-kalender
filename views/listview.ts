import { getWeekNumber, getEventColor, escapeHtml } from './utils';

export function renderListView(session: any) {
  const isDarkMode = session.settings?.darkMode || false;
  const events = session.events || [];
  const profiles = session.settings?.profiles || [];
  const activeProfileId = session.settings?.activeProfileId || 'default';
  const activeProfile = profiles.find((p: any) => p.id === activeProfileId);
  const visibleCalendarIds = activeProfile?.calendarIds || [];
  const hiddenEvents = session.hiddenEvents || [];
  
  console.log('Rendering ListView:', {
    totalEvents: events.length,
    visibleCalendarIds,
    hiddenEvents: hiddenEvents.length
  });
  
  const filteredEvents = events
    .filter((e: any) => !e.calendarId || visibleCalendarIds.includes(e.calendarId))
    .filter((e: any) => {
      const eventKey = `${e.calendarId}_${e.summary}_${e.start}`;
      return !hiddenEvents.includes(eventKey);
    })
    .sort((a: any, b: any) => {
      const dateA = new Date(a.start).getTime();
      const dateB = new Date(b.start).getTime();
      return dateA - dateB;
    });

  console.log('Filtered events:', filteredEvents.length);

  const cardClasses = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const today = new Date().toISOString().split('T')[0];

  // Group events by date
  const eventsByDate: { [key: string]: any[] } = {};
  filteredEvents.forEach((event: any) => {
    const date = new Date(event.start);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    if (!eventsByDate[dateStr]) {
      eventsByDate[dateStr] = [];
    }
    eventsByDate[dateStr].push(event);
  });

  const dateKeys = Object.keys(eventsByDate).sort();

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
            onclick="window.print()"
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
              ` : dateKeys.map(dateStr => {
                const date = new Date(dateStr);
                const weekDays = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];
                const dayName = weekDays[date.getDay()];
                const weekNumber = getWeekNumber(date);
                const dayEvents = eventsByDate[dateStr];

                return dayEvents.map((event: any, eventIndex: number) => {
                  const eventDate = new Date(event.start);
                  const endDate = event.end ? new Date(event.end) : eventDate;
                  const eventColor = getEventColor(event.summary, session.settings?.keywordRules || []);
                  
                  const isWholeDay = eventDate.getHours() === 0 && eventDate.getMinutes() === 0 && 
                                     endDate.getHours() === 0 && endDate.getMinutes() === 0 &&
                                     endDate.getDate() !== eventDate.getDate();

                  const isFirstOfDay = eventIndex === 0;

                  return `
                    <tr class="border-t ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}">
                      <td class="px-2 py-2 text-center text-xs">${isFirstOfDay ? String(weekNumber).padStart(2, '0') : ''}</td>
                      <td class="px-2 py-2 text-xs">${isFirstOfDay ? eventDate.toLocaleDateString('sv-SE') : ''}</td>
                      <td class="px-2 py-2 text-xs">${isFirstOfDay ? dayName : ''}</td>
                      <td class="px-2 py-2">
                        <span class="px-2 py-0.5 rounded text-xs font-medium" style="background-color: ${eventColor.bg}; color: ${eventColor.text}">
                          ${escapeHtml(event.summary)}
                        </span>
                      </td>
                      <td class="px-2 py-2 text-xs">${isWholeDay ? 'Heldag' : eventDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td class="px-2 py-2 text-xs">${isWholeDay ? 'Heldag' : (event.end ? endDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : '-')}</td>
                      <td class="px-2 py-2 text-xs">${escapeHtml(event.description || '-')}</td>
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
                }).join('');
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}
