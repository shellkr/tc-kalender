import { getEventColor, formatTime, formatDate } from '../utils/helpers';

export function renderMonthView(session: any, offset: number = 0) {
  const isDarkMode = session.settings?.darkMode || false;
  const events = session.events || [];
  const profiles = session.settings?.profiles || [];
  const activeProfileId = session.settings?.activeProfileId || 'default';
  const activeProfile = profiles.find((p: any) => p.id === activeProfileId);
  const visibleCalendarIds = activeProfile?.calendarIds || [];
  const keywordRules = session.settings?.keywordRules || [];
  const hiddenEvents = session.hiddenEvents || [];
  
  // Filter visible and non-hidden events
  const filteredEvents = events.filter((e: any) => {
    if (e.calendarId && !visibleCalendarIds.includes(e.calendarId)) return false;
    const eventStart = typeof e.start === 'string' ? e.start : e.start.toISOString();
    const eventKey = `${e.calendarId}_${e.summary}_${eventStart}`;
    return !hiddenEvents.includes(eventKey);
  });

  const currentDate = new Date();
  currentDate.setMonth(currentDate.getMonth() + offset);
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

  // Helper to check if event is whole day
  const isWholeDayEvent = (event: any) => {
    const start = typeof event.start === 'string' ? new Date(event.start) : event.start;
    const end = event.end ? (typeof event.end === 'string' ? new Date(event.end) : event.end) : start;
    return (
      start.getHours() === 0 && 
      start.getMinutes() === 0 && 
      end.getHours() === 0 && 
      end.getMinutes() === 0 &&
      end.getDate() !== start.getDate()
    );
  };

  // Helper to format event time
  const formatEventTime = (event: any) => {
    if (isWholeDayEvent(event)) return '';
    const start = typeof event.start === 'string' ? new Date(event.start) : event.start;
    const end = event.end ? (typeof event.end === 'string' ? new Date(event.end) : event.end) : null;
    const startTime = formatTime(start);
    if (end && end.getTime() !== start.getTime()) {
      const endTime = formatTime(end);
      return `${startTime}-${endTime}`;
    }
    return startTime;
  };

  // Helper to check if event is in the past
  const isEventPast = (event: any) => {
    const now = new Date();
    const eventEnd = event.end ? (typeof event.end === 'string' ? new Date(event.end) : event.end) : (typeof event.start === 'string' ? new Date(event.start) : event.start);
    
    if (isWholeDayEvent(event)) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const eventDate = typeof event.start === 'string' ? new Date(event.start) : event.start;
      eventDate.setHours(0, 0, 0, 0);
      return eventDate < today;
    }
    return eventEnd < now;
  };

  // Build calendar grid for arrow calculations
  const buildCalendarGrid = () => {
    const grid = [];
    const totalCells = startDayOfWeek + daysInMonth;
    const weeks = Math.ceil(totalCells / 7);
    
    let dayCounter = 1 - startDayOfWeek;
    for (let week = 0; week < weeks; week++) {
      const weekDays = [];
      for (let day = 0; day < 7; day++) {
        if (dayCounter >= 1 && dayCounter <= daysInMonth) {
          weekDays.push(dayCounter);
        } else {
          weekDays.push(null);
        }
        dayCounter++;
      }
      grid.push(weekDays);
    }
    return grid;
  };

  // Find special events for arrows
  const findSpecialEvents = () => {
    const grid = buildCalendarGrid();
    const flatDates = grid.flat();
    const arrowRanges: any[] = [];
    
    // Track "bemanning start" to "bemanning klar"
    let bemanningStart = null;
    flatDates.forEach((day, idx) => {
      if (day === null) return;
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEvents = filteredEvents.filter((e: any) => {
        const eventDate = typeof e.start === 'string' ? new Date(e.start) : e.start;
        return formatDate(eventDate) === dateStr;
      });
      
      dayEvents.forEach((event: any) => {
        const summary = event.summary.toLowerCase();
        if (summary.includes('bemanning start')) {
          bemanningStart = idx;
        } else if (summary.includes('bemanning klar') && bemanningStart !== null) {
          arrowRanges.push({ start: bemanningStart, end: idx, type: 'bemanning' });
          bemanningStart = null;
        }
      });
    });
    
    // Track "schemaspik" to next Sunday
    flatDates.forEach((day, idx) => {
      if (day === null) return;
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEvents = filteredEvents.filter((e: any) => {
        const eventDate = typeof e.start === 'string' ? new Date(e.start) : e.start;
        return formatDate(eventDate) === dateStr;
      });
      
      dayEvents.forEach((event: any) => {
        const summary = event.summary.toLowerCase();
        // Check for both variations
        if (summary.includes('schemaspik') || summary.includes('tc schemaspik')) {
          // Find next Sunday from this day
          const currentDate = new Date(year, month, day);
          const currentDayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
          
          // If already Sunday, go to next Sunday (7 days)
          // Otherwise, calculate days until next Sunday
          const daysUntilSunday = currentDayOfWeek === 0 ? 7 : 7 - currentDayOfWeek;
          
          const nextSunday = new Date(currentDate);
          nextSunday.setDate(nextSunday.getDate() + daysUntilSunday);
          
          // Check if next Sunday is in same month, or find it in the grid even if next month
          const sundayDay = nextSunday.getDate();
          const sundayMonth = nextSunday.getMonth();
          
          let endIdx = -1;
          if (sundayMonth === month) {
            // Sunday is in current month
            endIdx = flatDates.indexOf(sundayDay);
          } else {
            // Sunday is in next month - use last day of grid
            endIdx = flatDates.length - 1;
          }
          
          if (endIdx > idx) {
            arrowRanges.push({ start: idx, end: endIdx, type: 'schemaspik' });
          }
        }
      });
    });
    
    return { arrowRanges, grid };
  };

  const { arrowRanges, grid } = findSpecialEvents();

  // Generate SVG arrows
  const generateArrows = () => {
    if (arrowRanges.length === 0) return '';
    
    const arrows: string[] = [];
    const cellWidth = 100 / 7;
    const cellHeight = 100 / grid.length;
    
    arrowRanges.forEach((range, idx) => {
      const startWeek = Math.floor(range.start / 7);
      const startDay = range.start % 7;
      const endWeek = Math.floor(range.end / 7);
      const endDay = range.end % 7;
      
      const startX = (startDay + 0.5) * cellWidth;
      const startY = (startWeek + 0.5) * cellHeight;
      const endX = (endDay + 0.5) * cellWidth;
      const endY = (endWeek + 0.5) * cellHeight;
      
      let pathD = '';
      if (startWeek === endWeek) {
        pathD = `M ${startX} ${startY} L ${endX} ${endY}`;
      } else {
        pathD = `M ${startX} ${startY} L ${100} ${startY}`;
        for (let w = startWeek + 1; w < endWeek; w++) {
          const weekY = (w + 0.5) * cellHeight;
          pathD += ` M 0 ${weekY} L 100 ${weekY}`;
        }
        pathD += ` M 0 ${endY} L ${endX} ${endY}`;
      }
      
      arrows.push(`
        <g>
          <path d="${pathD}" stroke="#dc2626" stroke-width="0.4" fill="none" vector-effect="non-scaling-stroke" />
          <circle cx="${startX}" cy="${startY}" r="0.4" fill="#dc2626" />
          <polygon points="${endX},${endY} ${endX - 1},${endY - 0.7} ${endX - 1},${endY + 0.7}" fill="#dc2626" />
        </g>
      `);
    });
    
    return arrows.join('');
  };

  const arrowsSVG = generateArrows();

  let html = `
    <div class="rounded-lg shadow-sm border overflow-hidden ${cardClasses}">
      <div class="px-4 py-3 border-b flex items-center justify-between ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'}">
        <button 
          hx-get="/view/calendar/month?offset=${offset - 1}"
          hx-target="#calendar-content"
          hx-swap="innerHTML"
          class="p-2 rounded hover:bg-opacity-50 ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}"
        >
          ◀
        </button>
        <h3 class="text-lg font-semibold">${monthNames[month]} ${year}</h3>
        <button 
          hx-get="/view/calendar/month?offset=${offset + 1}"
          hx-target="#calendar-content"
          hx-swap="innerHTML"
          class="p-2 rounded hover:bg-opacity-50 ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}"
        >
          ▶
        </button>
      </div>
      
      <div style="position: relative;">
        ${arrowsSVG ? `
          <svg 
            style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 10;"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            ${arrowsSVG}
          </svg>
        ` : ''}
        
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
    const dateStr = formatDate(date);
    
    // Find events for this day
    const dayEvents = filteredEvents.filter((e: any) => {
      const eventDate = typeof e.start === 'string' ? new Date(e.start) : e.start;
      return formatDate(eventDate) === dateStr;
    }).sort((a: any, b: any) => {
      // Sort: whole-day events first, then by start time
      const aWhole = isWholeDayEvent(a);
      const bWhole = isWholeDayEvent(b);
      if (aWhole && !bWhole) return -1;
      if (!aWhole && bWhole) return 1;
      const aStart = typeof a.start === 'string' ? new Date(a.start) : a.start;
      const bStart = typeof b.start === 'string' ? new Date(b.start) : b.start;
      return aStart.getTime() - bStart.getTime();
    });

    const isToday = date.toDateString() === new Date().toDateString();

    // Determine styling based on event count
    const eventCount = dayEvents.length;
    let fontSize = 'text-xs';
    let padding = 'p-1';
    let gap = 'space-y-1';
    
    if (eventCount === 0) {
      fontSize = 'text-xs';
      padding = 'p-1';
      gap = 'space-y-1';
    } else if (eventCount === 1) {
      fontSize = 'text-xs';
      padding = 'p-1';
      gap = 'space-y-1';
    } else if (eventCount === 2) {
      fontSize = 'text-xs';
      padding = 'p-0.5';
      gap = 'space-y-0.5';
    } else if (eventCount <= 4) {
      fontSize = 'text-[10px]';
      padding = 'p-0.5';
      gap = 'space-y-0.5';
    } else {
      fontSize = 'text-[9px]';
      padding = 'p-0.5';
      gap = 'space-y-0.5';
    }

    html += `
      <div class="min-h-24 ${padding} border-b border-r flex flex-col ${isDarkMode ? 'border-gray-600' : 'border-gray-200'} ${isToday ? (isDarkMode ? 'bg-blue-900' : 'bg-blue-50') : ''}">
        <div class="text-sm font-medium mb-1 flex-shrink-0 ${isToday ? 'text-blue-600 font-bold' : ''}">${day}</div>
        <div class="flex-1 ${gap} overflow-hidden">
          ${dayEvents.map((event: any) => {
            const eventColor = getEventColor(event.summary, keywordRules);
            const timeStr = formatEventTime(event);
            const isPast = isEventPast(event);
            const isWholeDay = isWholeDayEvent(event);
            
            let displayColor = eventColor.bg;
            let displayTextColor = eventColor.text;
            
            if (isPast) {
              const hexToRgba = (hex: string, alpha = 0.4) => {
                const r = parseInt(hex.slice(1, 3), 16);
                const g = parseInt(hex.slice(3, 5), 16);
                const b = parseInt(hex.slice(5, 7), 16);
                return `rgba(${r}, ${g}, ${b}, ${alpha})`;
              };
              displayColor = hexToRgba(eventColor.bg, 0.4);
              displayTextColor = isDarkMode ? '#9ca3af' : '#6b7280';
            }
            
            const tooltipTime = isWholeDay ? 'Heldag' : timeStr;
            const descriptionPart = event.description ? `\n${event.description}` : '';
            const pastPart = isPast ? ' (Avslutad)' : '';
            
            return `
              <div 
                class="${fontSize} rounded overflow-hidden ${isPast ? 'opacity-60' : ''} ${isWholeDay ? 'py-0.5' : 'py-1'}"
                style="background-color: ${displayColor}; color: ${displayTextColor}; line-height: ${eventCount === 1 ? '1.3' : '1.2'}; padding-left: 0.25rem; padding-right: 0.25rem;"
                title="${tooltipTime} - ${event.summary}${descriptionPart}${pastPart}"
              >
                <div class="truncate whitespace-nowrap">
                  ${timeStr ? `<span class="font-medium">${timeStr}</span> ` : ''}${event.summary}
                </div>
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
    </div>
  `;

  return html;
}
