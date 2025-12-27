import { getWeekNumber, getEventColor } from './utils';

export function renderPrintView(session: any, startDateParam?: string) {
  const isDarkMode = session.settings?.darkMode || false;
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
  const swedishDays = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];

  // Generate print HTML
  let printHTML = '<!DOCTYPE html><html><head><title>Kalender - ' + startDate + '</title><style>';
  printHTML += 'body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; color: #000; }';
  printHTML += 'h1 { text-align: center; margin-bottom: 20px; font-size: 18px; }';
  printHTML += 'table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }';
  printHTML += 'th { background-color: #f5f5f5; padding: 8px 4px; text-align: left; font-weight: bold; font-size: 11px; text-transform: uppercase; border: 1px solid #ddd; }';
  printHTML += 'td { padding: 6px 4px; border: 1px solid #ddd; vertical-align: top; font-size: 11px; }';
  printHTML += '.event-badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 10px; font-weight: bold; margin-right: 4px; margin-bottom: 2px; -webkit-print-color-adjust: exact; color-adjust: exact; print-color-adjust: exact; }';
  printHTML += '.week-cell { border-right: 2px solid #6b7280 !important; text-align: center !important; }';
  printHTML += '.week-separator { border-top: 2px solid #6b7280 !important; }';
  
  // Add event color classes
  keywordRules.forEach((rule: any) => {
    printHTML += '.event-' + rule.id + ' { background-color: ' + rule.color + ' !important; ';
    printHTML += 'color: ' + (rule.textColor || '#ffffff') + ' !important; ';
    if (rule.color === '#ffffff') {
      printHTML += 'border: 1px solid #ccc !important; ';
    }
    printHTML += '}';
  });
  
  printHTML += '.event-default { background-color: rgb(183, 183, 183) !important; color: #ffffff !important; }';
  printHTML += '@page { margin: 15mm; size: A4; }';
  printHTML += '</style></head><body>';
  printHTML += '<h1>Kalender från ' + startDate + '</h1>';
  printHTML += '<table><thead><tr>';
  printHTML += '<th style="width: 24px;">V</th>';
  printHTML += '<th style="width: 80px;">Datum</th>';
  printHTML += '<th style="width: 70px;">Dag</th>';
  printHTML += '<th>Händelser</th>';
  printHTML += '</tr></thead><tbody>';

  // Group events by week
  const weekGroups: any[] = [];
  let currentWeekEvents: any[] = [];
  let currentWeekNumber = null;

  filteredEvents.forEach((event: any) => {
    const date = new Date(event.start);
    const weekNumber = getWeekNumber(date);

    if (currentWeekNumber !== weekNumber) {
      if (currentWeekEvents.length > 0) {
        weekGroups.push({ weekNumber: currentWeekNumber, events: currentWeekEvents });
      }
      currentWeekEvents = [event];
      currentWeekNumber = weekNumber;
    } else {
      currentWeekEvents.push(event);
    }
  });

  if (currentWeekEvents.length > 0) {
    weekGroups.push({ weekNumber: currentWeekNumber, events: currentWeekEvents });
  }

  // Render each week
  weekGroups.forEach((weekGroup, weekIndex) => {
    const weekNumber = weekGroup.weekNumber;
    const weekEvents = weekGroup.events;

    // Group events by date
    const dateGroups = new Map<string, any[]>();
    weekEvents.forEach((event: any) => {
      const dateStr = new Date(event.start).toLocaleDateString('sv-SE');
      if (!dateGroups.has(dateStr)) {
        dateGroups.set(dateStr, []);
      }
      dateGroups.get(dateStr)!.push(event);
    });

    // Render each date in the week
    let firstRowInWeek = true;
    dateGroups.forEach((events, dateStr) => {
      const date = new Date(events[0].start);
      const dayName = swedishDays[date.getDay() === 0 ? 6 : date.getDay() - 1];

      events.forEach((event: any, eventIndex: number) => {
        const isFirstEventOfDate = eventIndex === 0;
        const eventColor = getEventColor(event.summary, keywordRules);
        
        const weekCellClass = 'week-cell' + (weekIndex > 0 && firstRowInWeek && isFirstEventOfDate ? ' week-separator' : '');
        const otherCellClass = weekIndex > 0 && firstRowInWeek && isFirstEventOfDate ? 'week-separator' : '';

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

        if (firstRowInWeek && isFirstEventOfDate) {
          firstRowInWeek = false;
        }
      });
    });
  });

  printHTML += '</tbody></table>';
  printHTML += '<div style="text-align: center; font-size: 10px; color: #666; margin-top: 20px;">';
  printHTML += 'Utskriven: ' + new Date().toLocaleDateString('sv-SE') + ' ' + new Date().toLocaleTimeString('sv-SE');
  printHTML += '</div></body></html>';

  return printHTML;
}

export function handlePrintView(c: any) {
  const session = c.get('session');
  if (!session) return c.redirect('/');

  const startDate = c.req.query('start_date');
  const printHTML = renderPrintView(session, startDate);

  // Return the print HTML directly
  c.header('Content-Type', 'text/html');
  return c.html(printHTML);
}
