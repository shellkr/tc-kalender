// views/login.ts - Login page rendering

/**
 * Render HTML layout wrapper
 */
function renderLayout(content: string, isDarkMode = false): string {
  return `<!DOCTYPE html>
<html lang="sv" class="${isDarkMode ? 'dark' : ''}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TimeCare Kalender App - Logga in</title>
  <link rel="icon" type="image/x-icon" href="/favicon.png">
  <link rel="shortcut icon" href="/favicon.png">
  <script src="https://unpkg.com/htmx.org@1.9.10"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = { darkMode: 'class' }
  </script>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .animate-spin { animation: spin 1s linear infinite; }
  </style>
</head>
<body class="min-h-screen ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}">
  ${content}
</body>
</html>`;
}

/**
 * Render the login page
 */
export function renderLoginPage(isDarkMode: boolean, error?: string): string {
  const content = `
    <div class="min-h-screen flex items-center justify-center p-4">
      <div class="absolute top-4 right-4">
        <button 
          hx-post="/toggle-dark-mode-anon" 
          hx-vals='{"isDark": "${!isDarkMode}"}'
          hx-target="body"
          hx-swap="outerHTML"
          class="p-2 rounded-lg ${isDarkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-100'}"
        >
          ${isDarkMode ? '☀️' : '🌙'}
        </button>
      </div>

      <div class="w-full max-w-md p-8 rounded-lg shadow-xl ${isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white'}">
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full mb-4">
            <span class="text-3xl">👤</span>
          </div>
          <h1 class="text-3xl font-bold mb-2">Kalendervyn</h1>
          <p class="${isDarkMode ? 'text-gray-400' : 'text-gray-600'}">Logga in för att synka mellan enheter</p>
        </div>

        ${error ? `<div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">${error}</div>` : ''}

        <form hx-post="/login" hx-target="body" hx-swap="outerHTML" class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-2">Användarnamn</label>
            <input 
              type="text" 
              name="username" 
              required 
              class="w-full px-4 py-2 border rounded-lg ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}" 
              placeholder="ditt-användarnamn" 
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-2">Lösenord</label>
            <input 
              type="password" 
              name="password" 
              required 
              class="w-full px-4 py-2 border rounded-lg ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}" 
              placeholder="ditt-lösenord" 
            />
          </div>
          <button 
            type="submit" 
            class="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            🔑 Logga in
          </button>
        </form>
        
        <div class="mt-6 pt-6 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} text-center text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}">
          <p>Inget konto? Ett konto skapas automatiskt.</p>
        </div>
      </div>
    </div>
  `;

  return renderLayout(content, isDarkMode);
}
