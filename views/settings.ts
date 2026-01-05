export function renderSettingsView(session: any) {
  const isDarkMode = session.settings?.darkMode || false;
  const keywordRules = session.settings?.keywordRules || [];
  const calendarUrls = session.settings?.calendarUrls || [];
  const profiles = session.settings?.profiles || [];
  const activeProfileId = session.settings?.activeProfileId || 'default';
  const hiddenEvents = session.hiddenEvents || [];

  const cardClasses = isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';

  return `
    <div class="space-y-6">
      <h2 class="text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}">Inställningar</h2>
      
      <!-- Appearance Settings -->
      <div class="rounded-lg shadow-sm border p-6 space-y-4 ${cardClasses}">
        <h3 class="text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}">Utseende</h3>
        <button
          hx-post="/toggle-dark-mode"
          hx-target="body"
          hx-swap="outerHTML"
          class="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-opacity-50"
        >
          ${isDarkMode ? '☀️ Ljust läge' : '🌙 Mörkt läge'}
        </button>
      </div>

      <!-- Profile Management -->
      <div class="rounded-lg shadow-sm border p-6 space-y-4 ${cardClasses}">
        <h3 class="text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}">Profiler (${profiles.length})</h3>
        <p class="text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}">
          Skapa profiler för att organisera dina kalendrar. Varje profil kan ha sina egna kalendrar.
        </p>

        <form hx-post="/profile/add" hx-target="#profile-list" hx-swap="beforeend" class="flex gap-2">
          <input
            type="text"
            name="name"
            placeholder="Nytt profilnamn"
            required
            class="flex-1 px-3 py-2 border rounded-lg ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}"
          />
          <button
            type="submit"
            class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            ➕ Lägg till profil
          </button>
        </form>

        <div id="profile-list" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          ${profiles.map((profile: any) => renderProfileCard(profile, calendarUrls, activeProfileId, isDarkMode)).join('')}
        </div>
      </div>

      <!-- Calendar Sources -->
      <div class="rounded-lg shadow-sm border p-6 space-y-4 ${cardClasses}">
        <h3 class="text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}">Kalenderkällor</h3>
        
        <div id="calendar-add-result"></div>
        
        <form 
          hx-post="/calendar/add-url" 
          hx-target="#calendar-add-result" 
          hx-swap="innerHTML"
          class="space-y-2"
        >
          <input
            type="url"
            name="url"
            placeholder="Lägg till kalender-URL"
            required
            class="w-full px-3 py-2 border rounded-lg ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}"
          />
          <button
            type="submit"
            class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            ➕ Lägg till URL
          </button>
        </form>

        <form 
          hx-post="/calendar/add-file" 
          hx-encoding="multipart/form-data" 
          hx-target="#calendar-add-result" 
          hx-swap="innerHTML"
          class="space-y-2"
        >
          <input
            type="file"
            name="file"
            accept=".ics"
            required
            class="w-full px-3 py-2 border rounded-lg ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}"
          />
          <button
            type="submit"
            class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            📤 Ladda upp ICS-fil
          </button>
        </form>

        <div id="calendar-list" class="space-y-2 mt-4">
          ${calendarUrls.length > 0 ? `
            <h4 class="text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-2">
              Tillagda kalendrar (${calendarUrls.length})
            </h4>
          ` : ''}
          ${calendarUrls.map((cal: any) => renderCalendarItem(cal, isDarkMode)).join('')}
        </div>
      </div>

      <!-- Keyword Rules -->
      <div class="rounded-lg shadow-sm border p-6 space-y-4 ${cardClasses}">
        <h3 class="text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}">Nyckelord och färger</h3>
        
        <div class="rounded-lg p-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}">
          <h4 class="font-medium mb-3 text-sm">Lägg till ny regel</h4>
          <form hx-post="/keyword/add" hx-target="#keyword-list" hx-swap="beforeend" class="space-y-3">
            <input
              type="text"
              name="name"
              placeholder="Regelnamn (t.ex. KTI)"
              required
              class="w-full px-3 py-2 border rounded ${isDarkMode ? 'bg-gray-600 border-gray-500 text-white' : 'border-gray-300'}"
            />
            <input
              type="text"
              name="keyword"
              placeholder="Nyckelord (t.ex. kti)"
              required
              class="w-full px-3 py-2 border rounded ${isDarkMode ? 'bg-gray-600 border-gray-500 text-white' : 'border-gray-300'}"
            />
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="block text-xs font-medium mb-1">Bakgrundsfärg</label>
                <input
                  type="color"
                  name="color"
                  value="#3b82f6"
                  class="w-full h-10 rounded border"
                />
              </div>
              <div>
                <label class="block text-xs font-medium mb-1">Textfärg</label>
                <input
                  type="color"
                  name="textColor"
                  value="#ffffff"
                  class="w-full h-10 rounded border"
                />
              </div>
            </div>
            <button
              type="submit"
              class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              ➕ Lägg till regel
            </button>
          </form>
        </div>

        <div id="keyword-list" class="space-y-3">
          ${keywordRules.map((rule: any) => renderKeywordRule(rule, isDarkMode)).join('')}
        </div>
      </div>

      <!-- Hidden Events -->
      ${hiddenEvents.length > 0 ? `
        <div class="rounded-lg shadow-sm border p-6 space-y-4 ${cardClasses}">
          <div class="flex items-center justify-between">
            <h3 class="text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}">Dolda händelser (${hiddenEvents.length})</h3>
            <button
              hx-post="/event/restore-all"
              hx-confirm="Är du säker?"
              hx-target="#hidden-events-list"
              hx-swap="innerHTML"
              class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              🔄 Återställ alla
            </button>
          </div>
          <div id="hidden-events-list" class="space-y-2">
            ${hiddenEvents.map((eventKey: string) => `
              <div class="flex items-start justify-between gap-3 p-3 rounded border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}">
                <div class="flex-1 min-w-0">
                  <div class="font-medium text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}">${eventKey}</div>
                </div>
                <button
                  hx-post="/event/restore"
                  hx-vals='{"key": "${eventKey}"}'
                  hx-target="closest div"
                  hx-swap="outerHTML swap:0.5s"
                  class="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                >
                  👁️ Återställ
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function renderCalendarItem(calendar: any, isDarkMode: boolean) {
  return `
    <div class="flex items-start gap-2 p-3 rounded border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}">
      <div class="flex-1 min-w-0">
        <div class="font-medium text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}">${calendar.name}</div>
        <div class="text-xs break-all ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}">${calendar.url}</div>
      </div>
      <button
        hx-delete="/calendar/${calendar.id}"
        hx-confirm="Är du säker?"
        hx-target="closest div"
        hx-swap="outerHTML swap:0.5s"
        class="p-2 text-red-600 hover:bg-red-100 rounded"
      >
        🗑️
      </button>
    </div>
  `;
}

function renderKeywordRule(rule: any, isDarkMode: boolean) {
  return `
    <div class="border rounded-lg p-3 ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <div
            class="w-6 h-6 rounded border flex items-center justify-center text-xs font-bold"
            style="background-color: ${rule.color}; color: ${rule.textColor || '#ffffff'}"
          >
            A
          </div>
          <div class="min-w-0 flex-1">
            <div class="font-medium text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}">${rule.name}</div>
            <div class="text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}">${rule.keywords.join(', ')}</div>
          </div>
        </div>
        <button
          hx-delete="/keyword/${rule.id}"
          hx-confirm="Är du säker?"
          hx-target="closest div"
          hx-swap="outerHTML swap:0.5s"
          class="p-2 text-red-600 hover:bg-red-100 rounded"
        >
          🗑️
        </button>
      </div>
    </div>
  `;
}

function renderProfileCard(profile: any, calendarUrls: any[], activeProfileId: string, isDarkMode: boolean) {
  const isActive = profile.id === activeProfileId;
  const selectedCalendars = profile.calendarIds || [];

  return `
    <div class="rounded-lg border p-4 ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'}">
      <div class="flex items-center justify-between mb-3">
        <div class="flex-1 min-w-0">
          <h4 class="font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}">
            ${profile.name}
            ${isActive ? '<span class="ml-2 text-xs bg-blue-600 text-white px-2 py-1 rounded">Aktiv</span>' : ''}
          </h4>
          <p class="text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}">
            ${selectedCalendars.length} av ${calendarUrls.length} kalendrar
          </p>
        </div>
        ${profile.id !== 'default' ? `
          <button
            hx-delete="/profile/${profile.id}"
            hx-confirm="Är du säker?"
            hx-target="closest div"
            hx-swap="outerHTML swap:0.5s"
            class="p-2 text-red-600 hover:bg-red-100 rounded"
          >
            🗑️
          </button>
        ` : ''}
      </div>

      ${calendarUrls.length > 0 ? `
        <div class="border-t pt-3 mt-3 space-y-2 ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}">
          <p class="text-xs font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}">Kalendrar i profilen:</p>
          <div class="max-h-48 overflow-y-auto space-y-1">
            ${calendarUrls.map((cal: any) => {
              const isSelected = selectedCalendars.includes(cal.id);
              return `
                <label class="flex items-center gap-2 p-1.5 rounded cursor-pointer ${isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-100'}">
                  <input
                    type="checkbox"
                    ${isSelected ? 'checked' : ''}
                    hx-post="/profile/${profile.id}/toggle-calendar"
                    hx-vals='{"calendarId": "${cal.id}"}'
                    hx-target="closest label"
                    hx-swap="outerHTML"
                    class="w-4 h-4 text-blue-600 rounded"
                  />
                  <span class="text-xs ${isDarkMode ? 'text-white' : 'text-gray-900'}">${cal.name}</span>
                </label>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}
