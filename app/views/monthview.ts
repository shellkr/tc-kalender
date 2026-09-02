// views/monthview.ts - Month view with week numbers on the left

import { getEventColor, formatTime, formatDate, getWeekNumber, getDisplaySummary } from '../utils/helpers';

export function renderMonthView(session: any, offset: number = 0, skipCheck: boolean = false) {
  const isDarkMode = session.settings?.darkMode || false;
  const events = session.events || [];
  const profiles = session.settings?.profiles || [];
  const activeProfileId = session.settings?.activeProfileId || 'default';
  const activeProfile = profiles.find((p: any) => p.id === activeProfileId);
  const visibleCalendarIds = activeProfile?.calendarIds || [];
  const keywordRules = session.settings?.keywordRules || [];
  const hiddenEvents = session.hiddenEvents || [];
  const holidays = session.holidays || {};
  
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
        if (summary.includes('schemaspik') || summary.includes('tc schemaspik')) {
          const currentDate = new Date(year, month, day);
          const currentDayOfWeek = currentDate.getDay();
          const daysUntilSunday = currentDayOfWeek === 0 ? 7 : 7 - currentDayOfWeek;
          
          const nextSunday = new Date(currentDate);
          nextSunday.setDate(nextSunday.getDate() + daysUntilSunday);
          
          const sundayDay = nextSunday.getDate();
          const sundayMonth = nextSunday.getMonth();
          
          let endIdx = -1;
          if (sundayMonth === month) {
            endIdx = flatDates.indexOf(sundayDay);
          } else {
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
    // Account for week number column - 40px out of total width
    // Calculate percentage based on actual pixel widths
    const weekColWidthPercent = 5; // Approximate percentage for 40px column
    const dayColWidth = (100 - weekColWidthPercent) / 7;
    const cellHeight = 100 / grid.length;
    
    arrowRanges.forEach((range, idx) => {
      const startWeek = Math.floor(range.start / 7);
      const startDay = range.start % 7;
      const endWeek = Math.floor(range.end / 7);
      const endDay = range.end % 7;
      
      // Offset X coordinates to account for week number column
      const startX = weekColWidthPercent + (startDay + 0.5) * dayColWidth;
      const startY = (startWeek + 0.5) * cellHeight;
      const endX = weekColWidthPercent + (endDay + 0.5) * dayColWidth;
      const endY = (endWeek + 0.5) * cellHeight;
      
      let pathD = '';
      if (startWeek === endWeek) {
        pathD = `M ${startX} ${startY} L ${endX} ${endY}`;
      } else {
        pathD = `M ${startX} ${startY} L ${100} ${startY}`;
        for (let w = startWeek + 1; w < endWeek; w++) {
          const weekY = (w + 0.5) * cellHeight;
          pathD += ` M ${weekColWidthPercent} ${weekY} L 100 ${weekY}`;
        }
        pathD += ` M ${weekColWidthPercent} ${endY} L ${endX} ${endY}`;
      }
      
      arrows.push(`
        <g>
          <path d="${pathD}" stroke="#dc2626" stroke-width="0.6" fill="none" vector-effect="non-scaling-stroke" />
          <circle cx="${startX}" cy="${startY}" r="0.5" fill="#dc2626" />
          <polygon points="${endX},${endY} ${endX - 1.2},${endY - 0.9} ${endX - 1.2},${endY + 0.9}" fill="#dc2626" />
        </g>
      `);
    });
    
    return arrows.join('');
  };

  const arrowsSVG = generateArrows();

  // Generate calendar HTML with week numbers
  let html = `
    <style>
      .month-grid-container {
        display: grid;
        grid-template-columns: 40px repeat(7, 1fr);
        gap: 0;
      }
      
      .week-number-cell {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 120px;
        font-weight: 600;
        font-size: 0.875rem;
        border-right: 2px solid ${isDarkMode ? '#4b5563' : '#9ca3af'};
        border-bottom: 1px solid ${isDarkMode ? '#374151' : '#e5e7eb'};
        background-color: ${isDarkMode ? '#374151' : '#f9fafb'};
        color: ${isDarkMode ? '#9ca3af' : '#6b7280'};
      }
      
      .day-header-cell {
        padding: 0.5rem;
        text-align: center;
        font-size: 0.875rem;
        font-weight: 500;
        border-bottom: 2px solid ${isDarkMode ? '#4b5563' : '#d1d5db'};
        border-right: 1px solid ${isDarkMode ? '#374151' : '#e5e7eb'};
        background-color: ${isDarkMode ? '#374151' : '#f9fafb'};
      }
      
      .week-header {
        border-bottom: 2px solid ${isDarkMode ? '#4b5563' : '#d1d5db'};
        border-right: 2px solid ${isDarkMode ? '#4b5563' : '#9ca3af'};
        background-color: ${isDarkMode ? '#374151' : '#f9fafb'};
      }
      
      .day-cell {
        min-height: 120px;
        max-height: 120px;
        padding: 0.25rem;
        border-bottom: 1px solid ${isDarkMode ? '#374151' : '#e5e7eb'};
        border-right: 1px solid ${isDarkMode ? '#374151' : '#e5e7eb'};
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      
      .day-cell.empty {
        background-color: ${isDarkMode ? '#111827' : '#f9fafb'};
      }
      
      .day-cell.today {
        background-color: ${isDarkMode ? '#1e3a8a' : '#dbeafe'};
      }
      
      .event-item {
        flex-shrink: 0;
        overflow: hidden;
        margin-bottom: 1px;
      }
      
      .holiday-text {
        color: #dc2626 !important;
        font-weight: bold;
      }
    </style>
    
    <div class="rounded-lg shadow-sm border overflow-hidden ${cardClasses}">
      <div class="px-4 py-3 border-b grid grid-cols-3 items-center ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'}">
        <button
          hx-get="/view/calendar/month?offset=${offset - 1}"
          hx-target="#calendar-content"
          hx-swap="innerHTML"
          class="justify-self-start p-2 rounded hover:bg-opacity-50 ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}"
        >
          ◀
        </button>
        <h3 class="text-lg font-semibold justify-self-center">${monthNames[month]} ${year}</h3>
        <div class="justify-self-end flex items-center gap-2">
          <button
            onclick="window.open('/view/calendar/print-month?offset=${offset}', '_blank')"
            class="icon-button flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all shadow-sm hover:shadow-md"
            title="Skriv ut månad"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span class="font-medium text-sm">Skriv ut</span>
          </button>
          <button
            hx-get="/view/calendar/month?offset=${offset + 1}"
            hx-target="#calendar-content"
            hx-swap="innerHTML"
            class="p-2 rounded hover:bg-opacity-50 ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-200'}"
          >
            ▶
          </button>
        </div>
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
        
        <div class="month-grid-container">
          <!-- Header row with week number column -->
          <div class="week-header px-2 py-2 text-center text-xs font-medium uppercase">V</div>
          ${dayNames.map(day => `
            <div class="day-header-cell">
              ${day}
            </div>
          `).join('')}
  `;

  // Build calendar rows with week numbers
  const calendarGrid = buildCalendarGrid();
  
  calendarGrid.forEach((weekDays, weekIndex) => {
    // Get week number from first valid day in the week
    const firstValidDay = weekDays.find(d => d !== null);
    const weekNumber = firstValidDay 
      ? getWeekNumber(new Date(year, month, firstValidDay))
      : getWeekNumber(new Date(year, month, 1));
    
    // Week number cell
    html += `
      <div class="week-number-cell">
        ${String(weekNumber).padStart(2, '0')}
      </div>
    `;
    
    // Day cells for this week
    weekDays.forEach((day) => {
      if (day === null) {
        // Empty cell for days outside current month
        html += `<div class="day-cell empty"></div>`;
      } else {
        // Day cell with events
        const date = new Date(year, month, day);
        const dateStr = formatDate(date);
        const isHolidayDate = holidays[dateStr] !== undefined;
        const holidayName = holidays[dateStr] || '';
        
        // Find events for this day
        const dayEvents = filteredEvents.filter((e: any) => {
          const eventDate = typeof e.start === 'string' ? new Date(e.start) : e.start;
          return formatDate(eventDate) === dateStr;
        }).sort((a: any, b: any) => {
          const aWhole = isWholeDayEvent(a);
          const bWhole = isWholeDayEvent(b);
          if (aWhole && !bWhole) return -1;
          if (!aWhole && bWhole) return 1;
          const aStart = typeof a.start === 'string' ? new Date(a.start) : a.start;
          const bStart = typeof b.start === 'string' ? new Date(b.start) : b.start;
          return aStart.getTime() - bStart.getTime();
        });

        const isToday = date.toDateString() === new Date().toDateString();

        // Determine styling based on event count - better text sizing
        const eventCount = dayEvents.length;
        let fontSize = 'text-xs';
        let lineHeight = '1.2';
        let paddingY = 'py-0.5';
        
        if (eventCount === 0) {
          fontSize = 'text-xs';
          lineHeight = '1.3';
          paddingY = 'py-1';
        } else if (eventCount <= 2) {
          fontSize = 'text-xs';
          lineHeight = '1.2';
          paddingY = 'py-0.5';
        } else if (eventCount <= 4) {
          fontSize = 'text-[10px]';
          lineHeight = '1.1';
          paddingY = 'py-0';
        } else if (eventCount <= 6) {
          fontSize = 'text-[9px]';
          lineHeight = '1.0';
          paddingY = 'py-0';
        } else {
          fontSize = 'text-[8px]';
          lineHeight = '1.0';
          paddingY = 'py-0';
        }

        html += `
          <div class="day-cell ${isToday ? 'today' : ''}" ${holidayName ? `title="${holidayName}"` : ''}>
            <div class="text-sm font-medium mb-0.5 flex-shrink-0 ${isToday ? 'text-blue-600 font-bold' : ''} ${isHolidayDate ? 'holiday-text' : ''}">${day}</div>
            <div class="flex-1 overflow-hidden">
              ${dayEvents.slice(0, 8).map((event: any) => {
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
                    class="event-item ${fontSize} rounded ${isPast ? 'opacity-60' : ''} ${paddingY} px-1"
                    style="background-color: ${displayColor}; color: ${displayTextColor}; line-height: ${lineHeight};"
                    title="${tooltipTime} - ${event.summary}${descriptionPart}${pastPart}"
                  >
                    <div class="truncate whitespace-nowrap">
                      ${timeStr ? `<span class="font-medium">${timeStr}</span> ` : ''}${getDisplaySummary(event.summary)}
                    </div>
                  </div>
                `;
              }).join('')}
              ${dayEvents.length > 8 ? `
                <div class="text-[9px] text-gray-500 px-1 mt-0.5">+${dayEvents.length - 8} fler</div>
              ` : ''}
            </div>
          </div>
        `;
      }
    });
  });

  html += `
        </div>
      </div>
    </div>

    ${!skipCheck ? `
      <script>
        (function() {
          // Only run background check if this is NOT a reload from the check itself
          if (window.tcAppSkipBackgroundCheck) {
            window.tcAppSkipBackgroundCheck = false;
            return;
          }
          
          let isChecking = false;
          
          async function checkForChanges() {
            if (isChecking) return;
            isChecking = true;
            
            try {
              const response = await fetch('/calendar/check-changes');
              const result = await response.json();
              
              if (result.needsReload) {
                // Set flag to skip background check on next load
                window.tcAppSkipBackgroundCheck = true;
                
                // Reload month view silently
                htmx.ajax('GET', '/view/calendar/month?offset=${offset}', {
                  target: '#calendar-content',
                  swap: 'innerHTML'
                });
              }
            } catch (error) {
              console.error('Background check failed:', error);
            } finally {
              isChecking = false;
            }
          }
          
          // Run background check once after 1 second
          setTimeout(checkForChanges, 1000);
        })();
      </script>
    ` : ''}
  `;

  return html;
}
