import { getWeekNumber, getEventColor } from '../utils/helpers';

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
      const eventKey = `${e.calendarId}_${e.summary}_${e.start}`;
      return !hiddenEvents.includes(eventKey);
    })
    .sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const startDate = startDateParam || new Date().toISOString().split('T')[0];
  const swedishDays = ['Söndag', 'Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag'];

  // Generate print HTML with white background
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
      border: 1px solid #ddd;
      vertical-align: top;
      font-size: 11px;
      color: #000;
      background-color: #fff;
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
        <th>Händelser</th>
      </tr>
    </thead>
    <tbody>`;

  // Group events by date
  const eventsByDate = new Map<string, any[]>();
  filteredEvents.forEach((event: any) => {
    const eventDate = new Date(event.start);
    const dateStr = eventDate.toLocaleDateString('sv-SE');
    if (!eventsByDate.has(dateStr)) {
      eventsByDate.set(dateStr, []);
    }
    eventsByDate.get(dateStr)!.push(event);
  });

  // Sort dates
  const sortedDates = Array.from(eventsByDate.keys()).sort();

  // Track previous week number for separators
  let previousWeekNumber: number | null = null;

  // Render each date
  sortedDates.forEach(dateStr => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const weekNumber = getWeekNumber(date);
    const dayName = swedishDays[date.getDay()];
    const dayEvents = eventsByDate.get(dateStr) || [];

    // Check if this is a new week
    const isNewWeek = previousWeekNumber !== null && previousWeekNumber !== weekNumber;

    dayEvents.forEach((event: any, eventIndex: number) => {
      const isFirstEventOfDate = eventIndex === 0;
      
      const weekCellClass = 'week-cell' + (isNewWeek && isFirstEventOfDate ? ' week-separator' : '');
      const otherCellClass = isNewWeek && isFirstEventOfDate ? 'week-separator' : '';

      printHTML += '<tr>';
      printHTML += '<td class="' + weekCellClass + '">' + (isFirstEventOfDate ? String(weekNumber).padStart(2, '0') : '') + '</td>';
      printHTML += '<td class="' + otherCellClass + '">' + (isFirstEventOfDate ? dateStr : '') + '</td>';
      printHTML += '<td class="' + otherCellClass + '">' + (isFirstEventOfDate ? dayName : '') + '</td>';
      printHTML += '<td class="' + otherCellClass + '">';

      const eventDate = new Date(event.start);
      const eventEnd = event.end ? new Date(event.end) : eventDate;
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

      // Find matching rule for event
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

    previousWeekNumber = weekNumber;
  });

  printHTML += `
    </tbody>
  </table>
  <div class="footer">
    Utskriven: ${new Date().toLocaleDateString('sv-SE')} ${new Date().toLocaleTimeString('sv-SE')}
  </div>
  <script>
    // Auto-print when page loads
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`;

  return printHTML;
}

export function handlePrintView(c: any) {
  const session = c.get('session');
  if (!session) return c.redirect('/');

  const startDate = c.req.query('date');
  const printHTML = renderPrintView(session, startDate);

  return c.html(printHTML);
}
