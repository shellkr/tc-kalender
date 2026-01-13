export function renderConvertView(session: any) {
  const isDarkMode = session.settings?.darkMode || false;
  const cardClasses = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';

  return `
    <div class="space-y-6">
      <h2 class="text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}">Konvertera CSV till ICS</h2>
      
      <div class="rounded-lg shadow-sm border p-6 space-y-4 ${cardClasses}">
        <div class="rounded-lg p-4 ${isDarkMode ? 'bg-blue-900 bg-opacity-50' : 'bg-blue-50'}">
          <p class="text-sm ${isDarkMode ? 'text-blue-200' : 'text-blue-800'}">
            Ladda upp din CSV-fil från Timecare för att konvertera den till ICS-format som kan importeras i Outlook.
            Filen ska innehålla kolumnerna: Datum, Dag, Från, Till, Kod, och Anteckningar.
          </p>
        </div>
        
        <form 
          hx-post="/convert/csv" 
          hx-encoding="multipart/form-data"
          hx-target="#conversion-result"
          hx-swap="innerHTML"
          class="text-center space-y-4"
        >
          <input
            type="file"
            name="file"
            accept=".csv,.txt"
            required
            class="block w-full px-3 py-2 border rounded-lg ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}"
          />
          <button
            type="submit"
            class="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 mx-auto"
          >
            📤 Ladda upp och konvertera
          </button>
        </form>
      </div>

      <div id="conversion-result"></div>
    </div>
  `;
}

export function convertCsvToIcs(csvContent: string): { content: string, stats: any } {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
  
  let startIndex = -1;
  let headerRow = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('Datum') && line.includes('Dag') && line.includes('Från')) {
      startIndex = i;
      headerRow = line;
      break;
    }
  }

  if (startIndex === -1) {
    throw new Error('Kunde inte hitta schema-data i CSV-filen.');
  }

  let endIndex = lines.length;
  for (let i = startIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('Saldoinformation') || line.trim() === '' || line.includes('Tjänstetid')) {
      endIndex = i;
      break;
    }
  }

  const headers = headerRow.split(';').map(h => h.replace(/"/g, '').trim());

  const getColumnIndex = (columnName: string) => {
    return headers.findIndex(h => h.toLowerCase().includes(columnName.toLowerCase()));
  };

  const datumIndex = getColumnIndex('datum');
  const franIndex = getColumnIndex('från');
  const tillIndex = getColumnIndex('till');
  const kodIndex = getColumnIndex('kod');
  const anteckningarIndex = getColumnIndex('anteckningar');

  if (datumIndex === -1 || kodIndex === -1) {
    throw new Error('Kunde inte hitta nödvändiga kolumner.');
  }

  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TC Calendar App//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ].join('\n') + '\n';

  let eventCount = 0;
  let skippedCount = 0;
  let lastValidDate: any = null;

  for (let i = startIndex + 1; i < endIndex; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values = line.split(';').map(v => v.replace(/"/g, '').trim());
    
    const datum = values[datumIndex] || '';
    const kod = values[kodIndex] || '';
    const fran = values[franIndex] || '';
    const till = values[tillIndex] || '';
    const anteckningar = anteckningarIndex >= 0 ? (values[anteckningarIndex] || '') : '';

    // Skip rows with * in Kod column (summary rows)
    if (kod === '*') {
      skippedCount++;
      continue;
    }

    // If this row has a date, store it for potential detail rows that follow
    if (datum && datum.length >= 8) {
      const dateParts = datum.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (dateParts) {
        lastValidDate = {
          year: dateParts[1],
          month: dateParts[2],
          day: dateParts[3],
          dateStr: dateParts[1] + dateParts[2] + dateParts[3]
        };
      }
    }

    // Skip rows without code or without a valid date (either in this row or from previous row)
    if (!kod || (!datum && !lastValidDate)) {
      skippedCount++;
      continue;
    }

    // Use the date from this row if present, otherwise use the last valid date (for detail rows)
    let dateToUse = null;
    if (datum && datum.length >= 8) {
      const dateParts = datum.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (dateParts) {
        dateToUse = {
          year: dateParts[1],
          month: dateParts[2],
          day: dateParts[3],
          dateStr: dateParts[1] + dateParts[2] + dateParts[3]
        };
      }
    } else if (lastValidDate) {
      // This is a detail row - use the last valid date
      dateToUse = lastValidDate;
    }

    if (!dateToUse) {
      skippedCount++;
      continue;
    }

    let startTime = '090000';
    let endTime = '170000';
    let isNextDay = false;

    if (fran) {
      const timeMatch = fran.match(/(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        const hours = timeMatch[1].padStart(2, '0');
        const minutes = timeMatch[2];
        startTime = hours + minutes + '00';
      }
    }

    if (till) {
      isNextDay = till.includes('n');
      const cleanTill = till.replace('n', '').trim();
      const timeMatch = cleanTill.match(/(\d{1,2}):(\d{2})/);
      if (timeMatch) {
        const hours = timeMatch[1].padStart(2, '0');
        const minutes = timeMatch[2];
        endTime = hours + minutes + '00';
      }
    }

    const eventId = Math.random().toString(36).substr(2, 9);
    
    icsContent += 'BEGIN:VEVENT\n';
    icsContent += `DTSTART:${dateToUse.dateStr}T${startTime}\n`;
    
    if (isNextDay) {
      const startDate = new Date(
        parseInt(dateToUse.year), 
        parseInt(dateToUse.month) - 1, 
        parseInt(dateToUse.day)
      );
      const endDate = new Date(startDate.getTime() + 24 * 60 * 60 * 1000);
      const endDateStr = endDate.getFullYear() + 
                        String(endDate.getMonth() + 1).padStart(2, '0') + 
                        String(endDate.getDate()).padStart(2, '0');
      icsContent += `DTEND:${endDateStr}T${endTime}\n`;
    } else {
      icsContent += `DTEND:${dateToUse.dateStr}T${endTime}\n`;
    }
    
    icsContent += `SUMMARY:${kod}\n`;
    icsContent += 'LOCATION:\n';
    if (anteckningar) {
      icsContent += `DESCRIPTION:${anteckningar}\n`;
    }
    icsContent += `UID:${eventId}@tcapp.com\n`;
    icsContent += 'END:VEVENT\n';
    
    eventCount++;
  }

  icsContent += 'END:VCALENDAR';
  
  return {
    content: icsContent,
    stats: {
      eventsCreated: eventCount,
      rowsSkipped: skippedCount,
      totalRows: endIndex - startIndex - 1
    }
  };
}

export function renderConversionResult(icsContent: string, stats: any, isDarkMode: boolean) {
  const cardClasses = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const timestamp = new Date().toISOString().slice(0, 10);
  const filename = `arbetsschema_${timestamp}.ics`;
  
  // Escape content for safe embedding in HTML
  const escapedContent = icsContent
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');

  return `
    <div class="rounded-lg shadow-sm border p-6 space-y-4 ${cardClasses}">
      <h3 class="text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}">Konverteringsresultat</h3>
      
      <div class="rounded-lg p-4 ${isDarkMode ? 'bg-green-900 bg-opacity-50' : 'bg-green-50'}">
        <div class="text-sm ${isDarkMode ? 'text-green-200' : 'text-green-800'}">
          <p>✅ Konvertering slutförd!</p>
          <p>📅 Händelser skapade: ${stats.eventsCreated}</p>
          <p>📄 Rader behandlade: ${stats.totalRows}</p>
          ${stats.rowsSkipped > 0 ? `<p>⚠️ Rader hoppades över: ${stats.rowsSkipped}</p>` : ''}
        </div>
      </div>
      
      <div class="flex gap-2">
        <button
          onclick="downloadICS('${filename}', \`${escapedContent}\`)"
          class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          💾 Ladda ner ICS-fil
        </button>
        
        <button
          hx-post="/convert/import"
          hx-vals='{"icsContent": "${icsContent.replace(/"/g, '&quot;').replace(/\n/g, '\\n')}", "filename": "${filename}"}'
          hx-swap="none"
          class="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          👁️ Importera till kalender
        </button>
      </div>
      
      <div>
        <label class="block text-sm font-medium mb-2 ${isDarkMode ? 'text-white' : 'text-gray-700'}">
          📄 ICS-innehåll:
        </label>
        <textarea
          readonly
          class="w-full h-64 px-3 py-2 border rounded-lg font-mono text-xs ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-300'}"
        >${icsContent}</textarea>
      </div>
    </div>

    <script>
      function downloadICS(filename, content) {
        const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    </script>
  `;
}
