// routes/keywords.ts - Keyword rules management and settings view

import { Hono } from 'hono';
import { getSession, saveSessionData } from '../utils/auth';
import { renderSettingsView } from '../views/settings';
import { renderConvertView, convertCsvToIcs, renderConversionResult } from '../views/convert';
import { parseICS } from '../utils/helpers';

const keywords = new Hono();

// ==================== SETTINGS VIEW ====================

/**
 * Display settings view
 */
keywords.get('/view/settings', async (c) => {
  const session = await getSession(c);
  if (!session) return c.redirect('/login');
  
  return c.html(renderSettingsView(session));
});

// ==================== KEYWORD RULES CRUD ====================

/**
 * Add new keyword rule
 */
keywords.post('/keyword/add', async (c) => {
  const session = await getSession(c);
  if (!session) return c.text('');

  if (!session.settings.keywordRules) {
    session.settings.keywordRules = [];
  }
  
  const body = await c.req.parseBody();
  
  // Split keywords by comma and clean them up
  const keywordsString = body.keyword as string;
  const keywordList = keywordsString
    .split(',')
    .map(k => k.trim().toLowerCase())
    .filter(k => k.length > 0);
  
  const newRule = {
    id: Math.random().toString(36).substr(2, 9),
    name: body.name as string,
    keywords: keywordList,
    color: body.color as string,
    textColor: body.textColor as string
  };
  
  session.settings.keywordRules.push(newRule);
  saveSessionData(session);
  
  const isDarkMode = session.settings.darkMode || false;
  
  return c.html(`
    <div class="border rounded-lg p-3 ${isDarkMode ? 'border-gray-600' : 'border-gray-200'}">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-3 min-w-0 flex-1">
          <div 
            class="w-6 h-6 rounded border flex items-center justify-center text-xs font-bold flex-shrink-0" 
            style="background-color: ${newRule.color}; color: ${newRule.textColor}"
          >
            A
          </div>
          <div class="min-w-0 flex-1">
            <div class="font-medium text-sm ${isDarkMode ? 'text-white' : 'text-gray-900'}">${newRule.name}</div>
            <div class="text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}">${newRule.keywords.join(', ')}</div>
          </div>
        </div>
        <div class="flex gap-1 flex-shrink-0">
          <button
            hx-get="/keyword/${newRule.id}/edit"
            hx-target="closest div"
            hx-swap="outerHTML"
            class="p-2 text-blue-600 hover:bg-blue-100 rounded transition-colors"
            title="Redigera regel"
          >
            ✏️
          </button>
          <button 
            hx-delete="/keyword/${newRule.id}" 
            hx-confirm="Är du säker?" 
            hx-target="closest div" 
            hx-swap="outerHTML swap:0.5s" 
            class="p-2 text-red-600 hover:bg-red-100 rounded transition-colors"
            title="Ta bort regel"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
    <script>
      (function() {
        const calendarContent = document.getElementById('calendar-content');
        if (calendarContent) {
          const dateInput = document.getElementById('date-picker');
          const currentDate = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
          const editMode = document.querySelector('.event-checkbox') !== null;
          
          setTimeout(function() {
            htmx.ajax('GET', '/view/calendar/list?date=' + currentDate + '&editMode=' + editMode, {
              target: '#calendar-content',
              swap: 'innerHTML'
            });
          }, 100);
        }
      })();
    </script>
  `);
});

/**
 * Delete keyword rule
 */
keywords.delete('/keyword/:id', async (c) => {
  const session = await getSession(c);
  if (!session) return c.text('');
  
  const ruleId = c.req.param('id');
  session.settings.keywordRules = session.settings.keywordRules.filter((r: any) => r.id !== ruleId);
  
  saveSessionData(session);
  return c.text('');
});

/**
 * Get keyword rule for editing
 */
keywords.get('/keyword/:id/edit', async (c) => {
  const session = await getSession(c);
  if (!session) return c.text('');
  
  const ruleId = c.req.param('id');
  const rule = session.settings.keywordRules.find((r: any) => r.id === ruleId);
  
  if (!rule) return c.text('');
  
  const isDarkMode = session.settings.darkMode || false;
  return c.html(renderKeywordRuleEditing(rule, isDarkMode));
});

/**
 * Cancel keyword rule editing
 */
keywords.get('/keyword/:id/cancel-edit', async (c) => {
  const session = await getSession(c);
  if (!session) return c.text('');
  
  const ruleId = c.req.param('id');
  const rule = session.settings.keywordRules.find((r: any) => r.id === ruleId);
  
  if (!rule) return c.text('');
  
  const isDarkMode = session.settings.darkMode || false;
  return c.html(renderKeywordRuleDisplay(rule, isDarkMode));
});

/**
 * Save edited keyword rule
 */
keywords.post('/keyword/:id/edit', async (c) => {
  const session = await getSession(c);
  if (!session) return c.text('');
  
  const ruleId = c.req.param('id');
  const body = await c.req.parseBody();
  
  const updatedRule = {
    id: ruleId,
    name: body.name as string,
    keywords: (body.keywords as string)
      .split(',')
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length > 0),
    color: body.color as string,
    textColor: body.textColor as string
  };
  
  session.settings.keywordRules = session.settings.keywordRules.map((r: any) => 
    r.id === ruleId ? updatedRule : r
  );
  
  saveSessionData(session);
  
  const isDarkMode = session.settings.darkMode || false;
  return c.html(renderKeywordRuleDisplay(updatedRule, isDarkMode));
});

// ==================== CSV TO ICS CONVERSION ====================

/**
 * Display CSV to ICS conversion view
 */
keywords.get('/view/convert', async (c) => {
  const session = await getSession(c);
  if (!session) return c.redirect('/login');
  
  return c.html(renderConvertView(session));
});

/**
 * Convert uploaded CSV file to ICS
 */
keywords.post('/convert/csv', async (c) => {
  const session = await getSession(c);
  if (!session) return c.redirect('/login');

  try {
    const body = await c.req.parseBody();
    const file = body.file as File;
    const csvContent = await file.text();
    const result = convertCsvToIcs(csvContent);
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `arbetsschema_${timestamp}.ics`;
    return c.html(renderConversionResult(result.content, result.stats, session.settings?.darkMode || false, filename));
  } catch (error: any) {
    return c.html(`<div class="p-4 bg-red-100 text-red-700 rounded">Fel: ${error.message}</div>`);
  }
});

/**
 * Import converted ICS to calendar
 */
keywords.post('/convert/import', async (c) => {
  const session = await getSession(c);
  if (!session) return c.redirect('/login');

  try {
    const body = await c.req.parseBody();
    const icsContent = body.icsContent as string;
    const filename = body.filename as string;
    
    const calendarId = Math.random().toString(36).substr(2, 9);
    const result = parseICS(icsContent, calendarId);
    
    const newCalendar = { id: calendarId, url: filename, name: 'Konverterad från CSV' };
    session.settings.calendarUrls.push(newCalendar);
    
    result.events.forEach((e: any) => {
      session.events.push({
        ...e, 
        calendarId,
        start: e.start.toISOString(),
        end: e.end.toISOString(),
        id: e.id || Math.random().toString(36).substr(2, 9)
      });
    });
    
    saveSessionData(session);
    
    return c.html(`
      <div class="p-4 bg-green-100 text-green-700 rounded mb-2">
        ✅ ${result.events.length} händelser importerade till kalendern!
      </div>
      <script>setTimeout(() => { window.location.href = '/'; }, 1500);</script>
    `);
  } catch (error: any) {
    return c.html(`<div class="p-4 bg-red-100 text-red-700 rounded">Fel: ${error.message}</div>`);
  }
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Render keyword rule in display mode
 */
function renderKeywordRuleDisplay(rule: any, isDarkMode: boolean): string {
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
            class="p-2 text-blue-600 hover:bg-blue-100 rounded transition-colors"
            title="Redigera regel"
          >
            ✏️
          </button>
          <button
            hx-delete="/keyword/${rule.id}"
            hx-confirm="Är du säker?"
            hx-target="closest div"
            hx-swap="outerHTML swap:0.5s"
            class="p-2 text-red-600 hover:bg-red-100 rounded transition-colors"
            title="Ta bort regel"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render keyword rule in edit mode
 */
function renderKeywordRuleEditing(rule: any, isDarkMode: boolean): string {
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
        <div>
          <label class="block text-xs font-medium mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}">Förhandsgranskning</label>
          <div 
            id="preview-${rule.id}"
            class="h-10 rounded border border-gray-300 flex items-center justify-center text-xs font-medium"
            style="background-color: ${rule.color}; color: ${rule.textColor || '#ffffff'}"
          >
            ${rule.name}
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
      <script>
        (function() {
          const form = document.querySelector('form[hx-post="/keyword/${rule.id}/edit"]');
          if (!form) return;
          
          const colorInput = form.querySelector('input[name="color"]');
          const textColorInput = form.querySelector('input[name="textColor"]');
          const nameInput = form.querySelector('input[name="name"]');
          const preview = document.getElementById('preview-${rule.id}');
          
          function updatePreview() {
            if (preview && colorInput && textColorInput && nameInput) {
              preview.style.backgroundColor = colorInput.value;
              preview.style.color = textColorInput.value;
              preview.textContent = nameInput.value || '${rule.name}';
            }
          }
          
          if (colorInput) colorInput.addEventListener('input', updatePreview);
          if (textColorInput) textColorInput.addEventListener('input', updatePreview);
          if (nameInput) nameInput.addEventListener('input', updatePreview);
        })();
      </script>
    </div>
  `;
}

export default keywords;
