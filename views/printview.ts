import { getWeekNumber, getEventColor, formatDate } from '../utils/helpers';

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

export function renderPrintView(session: any, startDateParam?: string) {
  const events = session.events || [];
  const profiles = session.settings?.profiles || [];
  const activeProfileId = session.settings?.activeProfileId || 'default';
  const activeProfile = profiles.find((p: any) => p.id === activeProfileId);
  const visibleCalendarIds = activeProfile?.calendarIds || [];
  const hiddenEvents = session.hiddenEvents || [];
  const keywordRules = session.settings?.keywordRules || [];
  
  const filteredEvents = events
    .filter((e: any) => !e.calendarId || visibleCalendarIds.includes(e.calendarId))
    .filter((e: any) => {
      const eventStart = typeof e.start === 'string' ? e.start : e.start.toISOString();
      const eventKey = `${e.calendarId}_${e.summary}_${eventStart}`;
      return !hiddenEvents.includes(eventKey);
    })
    .sort((a: any, b: any) => {
      const aDate = typeof a.start === 'string' ? new Date(a.start) : a.start;
      const bDate = typeof b.start === 'string' ? new Date(b.start) : b.start;
      return aDate.getTime() - bDate.getTime();
    });

  const startDate = startDateParam || new Date().toISOString().split('T')[0];
  const swedishDays = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];

  // Generate date range starting from startDate (365 days)
  const startDateObj = new Date(startDate);
  const allDates: Date[] = [];
  for (let i = 0; i < 365; i++) {
    const date = new Date(startDateObj);
    date.setDate(startDateObj.getDate() + i);
    allDates.push(date);
  }

  // Build arrow ranges
  const arrowRanges: { start: number, end: number, type: string }[] = [];
  
  // Track bemanning start/end
  let bemanningStart: number | null = null;
  for (let idx = 0; idx < allDates.length; idx++) {
    const date = allDates[idx];
    const dateStr = formatDate(date);
    const dayEvents = filteredEvents.filter((e: any) => {
      const eventDate = typeof e.start === 'string' ? new Date(e.start) : e.start;
      return formatDate(eventDate) === dateStr;
    });
    
    for (const event of dayEvents) {
      if (isSpecialEvent(event.summary, ['bemanning start'])) {
        bemanningStart = idx;
      } else if (isSpecialEvent(event.summary, ['bemanning klar']) && bemanningStart !== null) {
        arrowRanges.push({ start: bemanningStart, end: idx, type: 'bemanning' });
        bemanningStart = null;
      }
    }
  }
  
  // Track schemaspik -> Sunday
  for (let idx = 0; idx < allDates.length; idx++) {
    const date = allDates[idx];
    const dateStr = formatDate(date);
    const dayEvents = filteredEvents.filter((e: any) => {
      const eventDate = typeof e.start === 'string' ? new Date(e.start) : e.start;
      return formatDate(eventDate) === dateStr;
    });
    
    for (const event of dayEvents) {
      if (isSpecialEvent(event.summary, ['TC schemaspik', 'schemaspik'])) {
        const nextSunday = getNextSunday(date);
        const nextSundayStr = formatDate(nextSunday);
        const endIdx = allDates.findIndex(d => formatDate(d) === nextSundayStr);
        if (endIdx !== -1 && endIdx > idx) {
          arrowRanges.push({ start: idx, end: endIdx, type: 'schemaspik' });
        }
      }
    }
  }
  
  // Function to check arrow state for a given date index
  const getArrowState = (idx: number): 'none' | 'start' | 'middle' | 'end' => {
    for (const range of arrowRanges) {
      if (idx === range.start) return 'start';
      if (idx === range.end) return 'end';
      if (idx > range.start && idx < range.end) return 'middle';
    }
    return 'none';
  };

  // Generate print HTML
  let printHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Kalender - ${startDate}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: Arial, sans-serif;
      margin: 20px;
      font-size: 12px;
      color: #000;
      background-color: #fff !important;
    }
    
    h1 {
      text-align: center;
      margin-bottom: 20px;
      font-size: 18px;
      color: #000;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 20px;
      background-color: #fff;
    }
    
    th {
      background-color: #f5f5f5 !important;
      padding: 8px 4px;
      text-align: left;
      font-weight: bold;
      font-size: 11px;
      text-transform: uppercase;
      border: 1px solid #ddd;
      color: #000;
    }
    
    td {
      padding: 6px 4px;
      vertical-align: top;
      font-size: 11px;
      color: #000;
      background-color: #fff;
    }
    
    .arrow-cell {
      width: 10px;
      min-width: 10px;
      max-width: 10px;
      padding: 0 !important;
      margin: 0 !important;
      border-left: 1px solid #d1d5db !important;
      border-right: 0px solid #d1d5db !important;
      background-color: #fff !important;
      position: relative;
      border-top: transparent !important;
      border-bottom: transparent !important;
    }
    
    .arrow-cell.week-separator {
      border-top: 2px solid #6b7280 !important;
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
    
    td {
      border-left: 1px solid #ddd;
      border-right: 1px solid #ddd;
      border-top: 0;
      border-bottom: 0;
    }
    
    tr:first-child td {
      border-top: 1px solid #ddd;
    }
    
    tr:last-child td {
      border-bottom: 1px solid #ddd;
    }
    
    .day-holiday {
      color: #dc2626 !important;
      font-weight: bold;
    }
    
    .event-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
      font-weight: bold;
      margin-right: 4px;
      margin-bottom: 2px;
      -webkit-print-color-adjust: exact;
      color-adjust: exact;
      print-color-adjust: exact;
    }
    
    .week-cell {
      border-right: 2px solid #6b7280 !important;
      text-align: center !important;
      background-color: #f9f9f9 !important;
      font-weight: bold;
    }
    
    .week-separator {
      border-top: 2px solid #6b7280 !important;
    }
    
    .footer {
      text-align: center;
      font-size: 10px;
      color: #666;
      margin-top: 20px;
    }`;

  // Add event color classes
  keywordRules.forEach((rule: any) => {
    printHTML += `
    .event-${rule.id} {
      background-color: ${rule.color} !important;
      color: ${rule.textColor || '#ffffff'} !important;`;
    if (rule.color === '#ffffff') {
      printHTML += `
      border: 1px solid #ccc !important;`;
    }
    printHTML += `
    }`;
  });

  printHTML += `
    .event-default {
      background-color: rgb(183, 183, 183) !important;
      color: #ffffff !important;
    }
    
    @page {
      margin: 15mm;
      size: A4;
    }
    
    @media print {
      body {
        background-color: #fff !important;
      }
      
      table {
        page-break-inside: auto;
      }
      
      tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }
      
      thead {
        display: table-header-group;
      }
    }
  </style>
</head>
<body>
  <h1>Kalender från ${startDate}</h1>
  <table>
    <thead>
      <tr>
        <th style="width: 24px;">V</th>
        <th style="width: 80px;">Datum</th>
        <th style="width: 70px;">Dag</th>
        <th style="width: 10px; min-width: 10px; max-width: 10px; padding: 0.375rem 0;"></th>
        <th>Händelser</th>
      </tr>
    </thead>
    <tbody>`;

  // Group events by date
  const eventsByDate = new Map<string, any[]>();
  filteredEvents.forEach((event: any) => {
    const eventDate = typeof event.start === 'string' ? new Date(event.start) : event.start;
    const dateStr = eventDate.toLocaleDateString('sv-SE');
    if (!eventsByDate.has(dateStr)) {
      eventsByDate.set(dateStr, []);
    }
    eventsByDate.get(dateStr)!.push(event);
  });

  // Group dates by week
  const weekGroups: Array<{
    weekNumber: number;
    dates: Array<{ date: Date; dateStr: string; eventCount: number; dateIndex: number }>;
    totalRows: number;
  }> = [];

  allDates.forEach((date, dateIndex) => {
    const weekNumber = getWeekNumber(date);
    const dateStr = date.toLocaleDateString('sv-SE');
    const events = eventsByDate.get(dateStr) || [];
    const eventCount = events.length || 1;

    let weekGroup = weekGroups.find(g => g.weekNumber === weekNumber);
    if (!weekGroup) {
      weekGroup = { weekNumber, dates: [], totalRows: 0 };
      weekGroups.push(weekGroup);
    }

    weekGroup.dates.push({ date, dateStr, eventCount, dateIndex });
    weekGroup.totalRows += eventCount;
  });

  // Render each week
  let isFirstWeek = true;
  weekGroups.forEach(weekGroup => {
    const { weekNumber, dates, totalRows } = weekGroup;
    let isFirstRowOfWeek = true;

    dates.forEach(({ date, dateStr, eventCount, dateIndex }) => {
      const dayName = swedishDays[date.getDay()];
      const dayEvents = eventsByDate.get(dateStr) || [];
      const arrowState = getArrowState(dateIndex);

      if (dayEvents.length === 0) {
        const weekCellClass = 'week-cell' + (!isFirstWeek && isFirstRowOfWeek ? ' week-separator' : '');
        const otherCellClass = !isFirstWeek && isFirstRowOfWeek ? 'week-separator' : '';
        const arrowCellClass = 'arrow-cell' + (!isFirstWeek && isFirstRowOfWeek ? ' week-separator' : '');

        printHTML += '<tr>';
        
        if (isFirstRowOfWeek) {
          printHTML += '<td class="' + weekCellClass + '" rowspan="' + totalRows + '">' + String(weekNumber).padStart(2, '0') + '</td>';
          isFirstRowOfWeek = false;
        }
        
        printHTML += '<td class="' + otherCellClass + '">' + dateStr + '</td>';
        printHTML += '<td class="' + otherCellClass + '">' + dayName + '</td>';
        printHTML += '<td class="' + arrowCellClass + '" rowspan="1">';
        if (arrowState !== 'none') {
          printHTML += '<div class="arrow-line' + (arrowState === 'start' ? ' arrow-start' : '') + (arrowState === 'end' ? ' arrow-end' : '') + '"></div>';
        }
        printHTML += '</td>';
        printHTML += '<td class="' + otherCellClass + '">-</td>';
        printHTML += '</tr>';
      } else {
        dayEvents.forEach((event: any, eventIndex: number) => {
          const isFirstEventOfDate = eventIndex === 0;
          
          const weekCellClass = 'week-cell' + (!isFirstWeek && isFirstRowOfWeek && isFirstEventOfDate ? ' week-separator' : '');
          const otherCellClass = !isFirstWeek && isFirstRowOfWeek && isFirstEventOfDate ? 'week-separator' : '';
          const arrowCellClass = 'arrow-cell' + (!isFirstWeek && isFirstRowOfWeek && isFirstEventOfDate ? ' week-separator' : '');

          printHTML += '<tr>';
          
          if (isFirstRowOfWeek) {
            printHTML += '<td class="' + weekCellClass + '" rowspan="' + totalRows + '">' + String(weekNumber).padStart(2, '0') + '</td>';
            isFirstRowOfWeek = false;
          }
          
          if (isFirstEventOfDate) {
            printHTML += '<td class="' + otherCellClass + '" rowspan="' + eventCount + '">' + dateStr + '</td>';
            printHTML += '<td class="' + otherCellClass + '" rowspan="' + eventCount + '">' + dayName + '</td>';
            printHTML += '<td class="' + arrowCellClass + '" rowspan="' + eventCount + '">';
            if (arrowState !== 'none') {
              printHTML += '<div class="arrow-line' + (arrowState === 'start' ? ' arrow-start' : '') + (arrowState === 'end' ? ' arrow-end' : '') + '"></div>';
            }
            printHTML += '</td>';
          }
          
          printHTML += '<td class="' + (isFirstEventOfDate ? otherCellClass : '') + '">';

          const eventDate = typeof event.start === 'string' ? new Date(event.start) : event.start;
          const eventEnd = event.end ? (typeof event.end === 'string' ? new Date(event.end) : event.end) : eventDate;
          const isWholeDay = eventDate.getHours() === 0 && eventDate.getMinutes() === 0 &&
                             eventEnd.getHours() === 0 && eventEnd.getMinutes() === 0 &&
                             eventEnd.getDate() !== eventDate.getDate();

          let eventTimeString;
          if (isWholeDay) {
            eventTimeString = '(Heldag)';
          } else {
            const startTime = eventDate.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
            const endTime = eventEnd && eventEnd.getTime() !== eventDate.getTime()
              ? eventEnd.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })
              : '';
            eventTimeString = endTime ? '(' + startTime + '-' + endTime + ')' : '(' + startTime + ')';
          }

          let eventClass = 'event-default';
          const summary = event.summary.toLowerCase();
          for (const rule of keywordRules) {
            if (rule.keywords.some((k: string) => summary.includes(k.toLowerCase()))) {
              eventClass = 'event-' + rule.id;
              break;
            }
          }

          printHTML += '<span class="event-badge ' + eventClass + '">';
          printHTML += event.summary + ' ' + eventTimeString;
          printHTML += '</span>';

          if (event.description && event.description.trim()) {
            printHTML += ' <small>(' + event.description.trim() + ')</small>';
          }

          printHTML += '</td>';
          printHTML += '</tr>';
        });
      }
    });

    isFirstWeek = false;
  });

  printHTML += `
    </tbody>
  </table>
  <div class="footer">
    Utskriven: ${new Date().toLocaleDateString('sv-SE')} ${new Date().toLocaleTimeString('sv-SE')}
  </div>
  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`;

  return printHTML;
}
