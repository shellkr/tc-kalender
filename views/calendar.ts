import { renderListView } from './listview';
import { renderMonthView } from './monthview';

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
            class="px-4 py-2 rounded-lg flex items-center gap-2 ${isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-600 text-white'}"
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

      <div id="calendar-content">
        ${renderListView(session)}
      </div>
    </div>
  `;
}

export { renderListView, renderMonthView };
