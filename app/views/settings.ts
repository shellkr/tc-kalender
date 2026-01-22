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
      <div class="flex items-center gap-3 mb-6">
        <svg class="w-8 h-8 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <h2 class="text-2xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}">Inställningar</h2>
      </div>
                  
      <!-- Appearance Settings -->
      <div class="rounded-lg shadow-sm border p-6 space-y-4 ${cardClasses}">
        <div class="flex items-center gap-3">
                  <svg class="w-5 h-5 ${isDarkMode ? 'text-purple-400' : 'text-purple-600'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                  </svg>
                  <h3 class="text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}">Utseende</h3>
                </div>
        <button
          hx-post="/toggle-dark-mode"
          hx-target="body"
          hx-swap="outerHTML"
          class="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-opacity-50 transition-all"
        >
          ${isDarkMode ? `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span>Ljust läge</span>
          ` : `
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
            <span>Mörkt läge</span>
          `}
        </button>
      </div>

      <!-- Profile Management -->
      <div class="rounded-lg shadow-sm border p-6 space-y-4 ${cardClasses}">
        <div class="flex items-center gap-3">
          <svg class="w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 class="text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}">
            Profiler (${profiles.length})
          </h3>
        </div>
        <p class="text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} flex items-start gap-2">
          <svg class="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Skapa profiler för att organisera dina kalendrar. Varje profil kan ha sina egna kalendrar.</span>
        </p>

        <form 
          hx-post="/profile/add" 
          hx-target="#profile-add-result" 
          hx-swap="innerHTML"
          class="flex gap-2"
        >
          <input
            type="text"
            name="name"
            id="profile-name-input"
            placeholder="Nytt profilnamn"
            required
            class="flex-1 px-3 py-2 border rounded-lg ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}"
          />
          <button
            type="submit"
            class="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm hover:shadow-md"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            <span>Lägg till profil</span>
          </button>
        </form>
        
        <div id="profile-add-result"></div>

        <div id="profile-list" class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          ${profiles.map((profile: any) => renderProfileCard(profile, calendarUrls, activeProfileId, isDarkMode)).join('')}
        </div>
      </div>

      <!-- Calendar Sources -->
      <div class="rounded-lg shadow-sm border p-6 space-y-4 ${cardClasses}">
        <div class="flex items-center gap-3">
          <svg class="w-5 h-5 ${isDarkMode ? 'text-green-400' : 'text-green-600'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 class="text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}">Kalenderkällor</h3>
        </div>
        
        <div id="calendar-add-result"></div>
        
        <form 
          hx-post="/calendar/add-url" 
          hx-target="#calendar-add-result" 
          hx-swap="innerHTML"
          class="space-y-2"
        >
          <div class="relative">
            <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            <input
              type="url"
              name="url"
              id="calendar-url-input"
              placeholder="Lägg till kalender-URL"
              required
              class="w-full pl-10 pr-3 py-2 border rounded-lg ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'} focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all shadow-sm hover:shadow-md"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Lägg till URL</span>
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
            id="calendar-file-input"
            accept=".ics"
            required
            class="w-full px-3 py-2 border rounded-lg ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'border-gray-300'}"
          />
          <button
            type="submit"
            class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-all shadow-sm hover:shadow-md"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <span>Ladda upp ICS-fil</span>
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
        <div class="flex items-center gap-3">
          <svg class="w-5 h-5 ${isDarkMode ? 'text-orange-400' : 'text-orange-600'}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
          </svg>
          <h3 class="text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}">Nyckelord och färger</h3>
        </div>
        <p class="text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} flex items-start gap-2">
          <svg class="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span>Lägg till regler för att färgkoda händelser baserat på nyckelord. Färgerna uppdateras automatiskt i kalendervyn.</span>
        </p>
        
        <div class="rounded-lg p-4 ${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'}">
          <h4 class="font-medium mb-3 text-sm flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Lägg till ny regel
          </h4>
          <form 
            hx-post="/keyword/add" 
            hx-target="#keyword-list" 
            hx-swap="beforeend"
            class="space-y-3"
          >
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
                <label class="block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}">Bakgrundsfärg</label>
                <input
                  type="color"
                  name="color"
                  value="#3b82f6"
                  class="w-full h-10 rounded border"
                />
              </div>
              <div>
                <label class="block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}">Textfärg</label>
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
              class="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all shadow-sm hover:shadow-md"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <span>Lägg till regel</span>
            </button>
          </form>
        </div>

        <div id="keyword-list" class="space-y-3">
          ${keywordRules.length === 0 ? `
            <div class="text-center py-8 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}">
              Inga regler tillagda ännu.
            </div>
          ` : ''}
          ${keywordRules.map((rule: any) => renderKeywordRule(rule, isDarkMode, false)).join('')}
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
              <div class="flex items-start gap-2 p-3 rounded border ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'} hover:shadow-md transition-all">
                <svg class="w-5 h-5 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'} flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
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
        class="p-2 rounded transition-colors hover:bg-red-100 ${isDarkMode ? 'hover:bg-red-900' : ''}"
        title="Ta bort kalender"
      >
        <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  `;
}

function renderKeywordRule(rule: any, isDarkMode: boolean, isEditing: boolean = false) {
  if (isEditing) {
    return `
      <div class="border rounded-lg p-3 ${isDarkMode ? 'border-gray-600 bg-gray-700' : 'border-gray-200 bg-gray-50'}">
        <form 
          hx-post="/keyword/${rule.id}/edit" 
          hx-target="closest div" 
          hx-swap="outerHTML"
          class="space-y-3"
        >
          <input
            type="text"
            name="name"
            value="${rule.name}"
            placeholder="Regelnamn"
            required
            class="w-full px-3 py-2 border rounded text-sm ${isDarkMode ? 'bg-gray-600 border-gray-500 text-white' : 'border-gray-300'}"
          />
          <input
            type="text"
            name="keywords"
            value="${rule.keywords.join(', ')}"
            placeholder="Nyckelord (kommaseparerade)"
            required
            class="w-full px-3 py-2 border rounded text-sm ${isDarkMode ? 'bg-gray-600 border-gray-500 text-white' : 'border-gray-300'}"
          />
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}">Bakgrundsfärg</label>
              <input
                type="color"
                name="color"
                value="${rule.color}"
                class="w-full h-10 rounded border"
              />
            </div>
            <div>
              <label class="block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}">Textfärg</label>
              <input
                type="color"
                name="textColor"
                value="${rule.textColor || '#ffffff'}"
                class="w-full h-10 rounded border"
              />
            </div>
          </div>
          <div class="flex gap-2">
            <button
              type="submit"
              class="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm"
            >
              ✓ Spara
            </button>
            <button
              type="button"
              hx-get="/keyword/${rule.id}/cancel-edit"
              hx-target="closest div"
              hx-swap="outerHTML"
              class="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-sm"
            >
              ✕ Avbryt
            </button>
          </div>
        </form>
      </div>
    `;
  }

  return `
    <div class="border rounded-lg p-3 ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <div
            class="w-6 h-6 rounded border flex items-center justify-center text-xs font-bold flex-shrink-0"
            style="background-color: ${rule.color}; color: ${rule.textColor || '#ffffff'}"
          >
            A
          </div>
          <div class="min-w-0 flex-1">
            <div class="font-medium text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}">${rule.name}</div>
            <div class="text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}">${rule.keywords.join(', ')}</div>
          </div>
        </div>
        <div class="flex gap-1 flex-shrink-0">
          <button
            hx-get="/keyword/${rule.id}/edit"
            hx-target="closest div"
            hx-swap="outerHTML"
            class="p-2 rounded transition-colors hover:bg-blue-100 ${isDarkMode ? 'hover:bg-blue-900' : ''}"
            title="Redigera regel"
          >
            <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            hx-delete="/keyword/${rule.id}"
            hx-confirm="Är du säker?"
            hx-target="closest div"
            hx-swap="outerHTML swap:0.5s"
            class="p-2 rounded transition-colors hover:bg-red-100 ${isDarkMode ? 'hover:bg-red-900' : ''}"
            title="Ta bort regel"
          >
            <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
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
            class="p-2 rounded transition-colors hover:bg-red-100 ${isDarkMode ? 'hover:bg-red-900' : ''}"
            title="Ta bort profil"
          >
            <svg class="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
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
