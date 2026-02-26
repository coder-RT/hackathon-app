let snippetsData = []
let faqsData = []
let resourcesData = {}
let quickActionsData = []
let appConfig = {}
let currentMode = 'auto'

const modeLabels = {
  auto: 'Auto',
  snippets: 'Snippets',
  llm: 'AI Generate'
}

const sourceLabels = {
  snippet: 'Snippet',
  generated: 'AI Generated',
  resource: 'Resource',
  faq: 'FAQ',
  tool: 'Tool',
  suggestions: 'Suggestions',
  none: 'Not Found',
  error: 'Error'
}

const sourceIcons = {
  snippet: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>',
  generated: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10H12V2z"></path></svg>',
  resource: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>',
  faq: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
  tool: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4"></path></svg>',
  suggestions: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>',
  none: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
  error: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
}

document.addEventListener('DOMContentLoaded', async () => {
  await initApp()
  loadSnippets()
  loadResources()
  loadFaqs()
  loadQuickActions()
  setupUpdateListeners()
  setupClickOutside()
  addWelcomeMessage()
})

async function initApp() {
  try {
    appConfig = await window.api.getConfig()
    console.log('App initialized:', appConfig)
  } catch (err) {
    console.error('Failed to initialize app config:', err)
  }
}

function addWelcomeMessage() {
  const chatBox = document.getElementById('chat-box')
  const welcome = document.createElement('div')
  welcome.className = 'message ai welcome-message'
  welcome.innerHTML = `
    <div class="welcome-content">
      <div class="welcome-header">
        <div class="welcome-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
        </div>
        <div>
          <h3>Welcome to your Hackathon Assistant</h3>
          <p class="welcome-subtitle">Your AI-powered companion for building faster</p>
        </div>
      </div>
      
      <div class="welcome-features">
        <div class="welcome-feature">
          <div class="feature-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>
          </div>
          <div class="feature-text">
            <strong>Code Snippets</strong>
            <span>Pre-built templates for common patterns</span>
          </div>
        </div>
        <div class="welcome-feature">
          <div class="feature-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
          </div>
          <div class="feature-text">
            <strong>Debugging Help</strong>
            <span>Troubleshoot errors and issues</span>
          </div>
        </div>
        <div class="welcome-feature">
          <div class="feature-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          </div>
          <div class="feature-text">
            <strong>Resources</strong>
            <span>Rules, timelines, and API docs</span>
          </div>
        </div>
        <div class="welcome-feature">
          <div class="feature-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 2a10 10 0 0 1 10 10"></path><path d="M12 2a7 7 0 0 1 7 7"></path></svg>
          </div>
          <div class="feature-text">
            <strong>AI Generation</strong>
            <span>Create custom code when needed</span>
          </div>
        </div>
      </div>
      
      <div class="welcome-suggestions">
        <span class="suggestions-label">Try asking:</span>
        <button class="suggestion-chip" onclick="useSuggestion('How do I set up FastAPI?')">How do I set up FastAPI?</button>
        <button class="suggestion-chip" onclick="useSuggestion('Show me file upload code')">Show me file upload code</button>
        <button class="suggestion-chip" onclick="useSuggestion('What are the hackathon rules?')">What are the rules?</button>
      </div>
    </div>
  `
  chatBox.appendChild(welcome)
}

function useSuggestion(text) {
  document.getElementById('input').value = text
  document.getElementById('input').focus()
}

function setupUpdateListeners() {
  window.api.onUpdateStatus((message) => {
    console.log('Update status:', message)
  })

  window.api.onUpdateReady((version) => {
    showUpdateBanner(version)
  })
}

function setupClickOutside() {
  document.addEventListener('click', (e) => {
    const modeMenu = document.getElementById('mode-menu')
    const modeToggle = document.querySelector('.mode-toggle')
    if (modeMenu && !modeMenu.contains(e.target) && !modeToggle.contains(e.target)) {
      modeMenu.classList.remove('show')
    }
  })
}

function showUpdateBanner(version) {
  const banner = document.createElement('div')
  banner.className = 'update-banner'
  banner.innerHTML = `
    <span>Update v${version} is ready!</span>
    <button onclick="window.api.restartApp()">Restart Now</button>
    <button onclick="this.parentElement.remove()">Later</button>
  `
  document.body.prepend(banner)
}

function toggleModeMenu() {
  const menu = document.getElementById('mode-menu')
  menu.classList.toggle('show')
}

function selectMode(mode) {
  currentMode = mode
  
  document.querySelectorAll('.mode-option').forEach(opt => {
    opt.classList.toggle('active', opt.dataset.mode === mode)
  })
  
  document.getElementById('current-mode-label').textContent = modeLabels[mode]
  document.getElementById('mode-menu').classList.remove('show')
}

function toggleQuickActions() {
  const panel = document.getElementById('quick-actions-panel')
  const isVisible = panel.style.display !== 'none'
  panel.style.display = isVisible ? 'none' : 'block'
  document.getElementById('mode-menu').classList.remove('show')
}

async function loadQuickActions() {
  try {
    quickActionsData = await window.api.fetchQuickActions()
    renderQuickActions()
  } catch (err) {
    console.error('Failed to load quick actions:', err)
  }
}

function renderQuickActions() {
  const grid = document.getElementById('quick-actions-grid')
  
  const categories = {
    backend: { label: 'Backend', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>', items: [] },
    frontend: { label: 'Frontend', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>', items: [] },
    feature: { label: 'Features', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>', items: [] },
    database: { label: 'Database', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>', items: [] },
    security: { label: 'Security', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>', items: [] },
    devops: { label: 'DevOps', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33"></path></svg>', items: [] },
    info: { label: 'Hackathon Info', icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>', items: [] }
  }
  
  quickActionsData.forEach(action => {
    if (categories[action.category]) {
      categories[action.category].items.push(action)
    }
  })
  
  let html = ''
  for (const [key, cat] of Object.entries(categories)) {
    if (cat.items.length > 0) {
      html += `<div class="qa-category"><span class="qa-label">${cat.icon} ${cat.label}</span></div>`
      html += cat.items.map(a => `
        <button class="qa-btn" onclick="executeQuickAction('${a.id}', '${a.type || 'snippet'}')">
          <span class="qa-icon">${a.icon}</span>
          <span class="qa-text">${a.label}</span>
        </button>
      `).join('')
    }
  }
  
  grid.innerHTML = html
}

async function executeQuickAction(id, type) {
  toggleQuickActions()
  
  if (type === 'resource') {
    const result = await window.api.sendMessage(`Show me the ${id}`, 'auto')
    appendMessage('ai', result.reply, result.source)
  } else {
    const snippet = await window.api.fetchSnippet(id)
    if (snippet && snippet.code) {
      const text = `**${snippet.name}**\n\nTags: ${snippet.tags.join(', ')}\n\n\`\`\`\n${snippet.code}\n\`\`\``
      appendMessage('ai', text, 'snippet')
    }
  }
}

async function send() {
  const input = document.getElementById('input')
  const message = input.value.trim()
  if (!message) return

  appendMessage('user', message)
  input.value = ''

  const typing = appendMessage('ai', '<span class="loading"></span> Thinking...', 'loading')

  const result = await window.api.sendMessage(message, currentMode)
  
  typing.remove()
  appendMessage('ai', result.reply, result.source)
}

function handleKeyPress(event) {
  if (event.key === 'Enter') send()
}

function formatMessage(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>')
}

function appendMessage(type, text, source = null) {
  const chatBox = document.getElementById('chat-box')
  const msg = document.createElement('div')
  msg.classList.add('message', type)
  
  let html = formatMessage(text)
  
  if (type === 'ai' && source && source !== 'loading') {
    const label = sourceLabels[source] || source
    const icon = sourceIcons[source] || ''
    html = `<div class="message-badge">${icon} ${label}</div>${html}`
  }
  
  msg.innerHTML = html
  chatBox.appendChild(msg)
  chatBox.scrollTop = chatBox.scrollHeight
  return msg
}

function showSection(section) {
  const sections = ['chat', 'snippets', 'resources', 'faq']
  sections.forEach(s => {
    document.getElementById(`${s}-section`).style.display = s === section ? 'flex' : 'none'
  })

  document.querySelectorAll('.nav-btn').forEach((btn, i) => {
    btn.classList.toggle('active', sections[i] === section)
  })
}

async function loadSnippets() {
  try {
    snippetsData = await window.api.fetchSnippets()
    renderSnippets(snippetsData)
  } catch (err) {
    document.getElementById('snippets-list').innerHTML =
      "<div class='empty-state'><span class='empty-state-icon'><svg width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5'><path d='M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z'></path><polyline points='14 2 14 8 20 8'></polyline></svg></span><span class='empty-state-text'>Failed to load snippets. Is the backend running?</span></div>"
  }
}

function renderSnippets(snippets) {
  const container = document.getElementById('snippets-list')
  
  if (snippets.length === 0) {
    container.innerHTML = "<div class='empty-state'><span class='empty-state-icon'><svg width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5'><circle cx='11' cy='11' r='8'></circle><line x1='21' y1='21' x2='16.65' y2='16.65'></line></svg></span><span class='empty-state-text'>No snippets match your search</span></div>"
    return
  }
  
  container.innerHTML = snippets.map(s => `
    <div class="card snippet-card" onclick="copySnippet('${s.id}')">
      <h3>${s.name}</h3>
      <div class="tags">${s.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
      <pre><code>${escapeHtml(getCodePreview(s.code, 7))}</code></pre>
      <button class="copy-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        Copy Code
      </button>
    </div>
  `).join('')
}

function filterSnippets() {
  const query = document.getElementById('snippet-search').value.toLowerCase()
  const filtered = snippetsData.filter(s =>
    s.name.toLowerCase().includes(query) ||
    s.tags.some(t => t.includes(query))
  )
  renderSnippets(filtered)
}

function copySnippet(id) {
  const snippet = snippetsData.find(s => s.id === id)
  if (snippet) {
    navigator.clipboard.writeText(snippet.code)
    showToast('Code copied to clipboard!')
  }
}

async function loadResources() {
  try {
    resourcesData = await window.api.fetchResources()
    showResourceTab('rules')
  } catch (err) {
    document.getElementById('resources-content').innerHTML =
      "<div class='empty-state'><span class='empty-state-icon'><svg width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5'><path d='M4 19.5A2.5 2.5 0 0 1 6.5 17H20'></path><path d='M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z'></path></svg></span><span class='empty-state-text'>Failed to load resources. Is the backend running?</span></div>"
  }
}

function showResourceTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const btnText = btn.textContent.toLowerCase().trim()
    btn.classList.toggle('active', btnText.includes(tab))
  })

  const content = document.getElementById('resources-content')

  if (tab === 'rules') {
    content.innerHTML = `
      <div class="resource-card">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
          </svg>
          Hackathon Rules
        </h3>
        <ul>${resourcesData.rules?.map(r => `<li>${r}</li>`).join('') || ''}</ul>
      </div>
    `
  } else if (tab === 'timeline') {
    content.innerHTML = `
      <div class="resource-card">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          Timeline
        </h3>
        <div class="timeline">
          ${resourcesData.timeline?.map(t => `
            <div class="timeline-item">
              <span class="time">${t.time}</span>
              <span class="event">${t.event}</span>
            </div>
          `).join('') || ''}
        </div>
      </div>
    `
  } else if (tab === 'apis') {
    const apis = resourcesData.apis || {}
    content.innerHTML = `
      <div class="resource-card">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
          Available APIs
        </h3>
        <div class="api-grid">
          ${Object.entries(apis).map(([key, api]) => `
            <div class="api-card">
              <h4>${api.name}</h4>
              <p>${api.description}</p>
              <a href="${api.docs}" target="_blank">
                View Documentation
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </a>
            </div>
          `).join('')}
        </div>
      </div>
    `
  } else if (tab === 'judging') {
    content.innerHTML = `
      <div class="resource-card">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
          Judging Criteria
        </h3>
        <div class="criteria-list">
          ${resourcesData.judging_criteria?.map(c => `
            <div class="criteria-item">
              <div class="criteria-header">
                <span class="criteria-name">${c.criteria}</span>
                <span class="criteria-weight">${c.weight}</span>
              </div>
              <p>${c.description}</p>
            </div>
          `).join('') || ''}
        </div>
      </div>
    `
  } else if (tab === 'prizes') {
    content.innerHTML = `
      <div class="resource-card">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="8" r="7"></circle>
            <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline>
          </svg>
          Prizes
        </h3>
        <div class="prize-list">
          ${resourcesData.prizes?.map(p => `
            <div class="prize-item">
              <span class="prize-place">${p.place}</span>
              <span class="prize-value">${p.prize}</span>
            </div>
          `).join('') || ''}
        </div>
      </div>
    `
  }
}

async function loadFaqs() {
  try {
    faqsData = await window.api.fetchFaqs()
    renderFaqs(faqsData)
  } catch (err) {
    document.getElementById('faq-list').innerHTML =
      "<div class='empty-state'><span class='empty-state-icon'><svg width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5'><circle cx='12' cy='12' r='10'></circle><path d='M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3'></path><line x1='12' y1='17' x2='12.01' y2='17'></line></svg></span><span class='empty-state-text'>Failed to load FAQs. Is the backend running?</span></div>"
  }
}

function renderFaqs(faqs) {
  const container = document.getElementById('faq-list')
  
  if (faqs.length === 0) {
    container.innerHTML = "<div class='empty-state'><span class='empty-state-icon'><svg width='48' height='48' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='1.5'><circle cx='11' cy='11' r='8'></circle><line x1='21' y1='21' x2='16.65' y2='16.65'></line></svg></span><span class='empty-state-text'>No FAQs match your search</span></div>"
    return
  }
  
  container.innerHTML = faqs.map(f => `
    <div class="faq-card" onclick="toggleFaq(this)">
      <div class="faq-question">
        <span class="faq-icon">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </span>
        <h3>${f.problem}</h3>
      </div>
      <div class="faq-answer">
        <div class="faq-keywords">
          ${f.keywords.map(k => `<span class="tag">${k}</span>`).join('')}
        </div>
        <div class="faq-solution">${formatMessage(f.solution)}</div>
      </div>
    </div>
  `).join('')
}

function filterFaqs() {
  const query = document.getElementById('faq-search').value.toLowerCase()
  const filtered = faqsData.filter(f =>
    f.problem.toLowerCase().includes(query) ||
    f.keywords.some(k => k.includes(query))
  )
  renderFaqs(filtered)
}

function toggleFaq(element) {
  element.classList.toggle('expanded')
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function getCodePreview(code, lines) {
  const codeLines = code.split('\n')
  if (codeLines.length <= lines) {
    return code
  }
  return codeLines.slice(0, lines).join('\n')
}

function showToast(message) {
  const toast = document.getElementById('toast') || createToast()
  toast.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
    ${message}
  `
  toast.classList.add('show')
  setTimeout(() => {
    toast.classList.remove('show')
  }, 2500)
}

function createToast() {
  const toast = document.createElement('div')
  toast.id = 'toast'
  toast.className = 'toast'
  document.body.appendChild(toast)
  return toast
}
