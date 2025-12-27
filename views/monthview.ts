import { getEventColor } from './utils';

export function renderMonthView(session: any) {
  const isDarkMode = session.settings?.darkMode || false;
  const events = session.events || [];
  const profiles = session.settings?.profiles || [];
  const activeProfileId = session.settings?.activeProfileId || 'default';
  const activeProfile = profiles.find((p: any) => p.id === activeProfileId);
  const visibleCalendarIds = activeProfile?.calendarIds || [];
  const keywordRules = session.settings?.keywordRules || [];
  
  const filteredEvents = events.filter((e: any) => 
    !e.calendarId || visibleCalendarIds.includes(e.calendarId)
  );

  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const monthNames = [
    'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
    'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'
  ];
  const dayNames = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday = 0

  const cardClasses = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';

  let html = `
    <div class="rounded-lg shadow-sm border overflow-hidden ${cardClasses}">
      <div class="px-4 py-3 border-b flex items-center justify-between ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'}">
        <button 
          hx-get="/view/calendar/month?offset=-1"
          hx-target="#calendar-content"
          hx-swap="innerHTML"
          class="p-2 rounded hover:bg-opacity-50 ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}"
        >
          ◀
        </button>
        <h3 class="text-lg font-semibold">${monthNames[month]} ${year}</h3>
        <button 
          hx-get="/view/calendar/month?offset=1"
          hx-target="#calendar-content"
          hx-swap="innerHTML"
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

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < startDayOfWeek; i++) {
    html += `<div class="min-h-24 p-2 border-b border-r ${isDarkMode ? 'border-gray-600 bg-gray-800 text-gray-500' : 'border-gray-200 bg-gray-50 text-gray-400'}"></div>`;
  }

  // Add cells for each day of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Find events for this day
    const dayEvents = filteredEvents.filter((e: any) => {
      const eventDate = new Date(e.start);
      const eventDateStr = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`;
      return eventDateStr === dateStr;
    });

    const isToday = date.toDateString() === new Date().toDateString();

    html += `
      <div class="min-h-24 p-2 border-b border-r flex flex-col ${isDarkMode ? 'border-gray-600' : 'border-gray-200'} ${isToday ? (isDarkMode ? 'bg-blue-900' : 'bg-blue-50') : ''}">
        <div class="text-sm font-medium mb-1 ${isToday ? 'text-blue-600 font-bold' : ''}">${day}</div>
        <div class="flex-1 space-y-1 overflow-hidden">
          ${dayEvents.map((event: any) => {
            const eventColor = getEventColor(event.summary, keywordRules);
            return `
              <div class="text-xs px-1 py-0.5 rounded overflow-hidden truncate" style="background-color: ${eventColor.bg}; color: ${eventColor.text}" title="${event.summary}">
                ${event.summary}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  html += `
      </div>
    </div>
  `;

  return html;
}
