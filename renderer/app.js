let snippetsData = []
let faqsData = []
let resourcesData = {}
let appConfig = {}

document.addEventListener('DOMContentLoaded', async () => {
  await initApp()
  loadSnippets()
  loadResources()
  loadFaqs()
  setupUpdateListeners()
})

async function initApp() {
  try {
    appConfig = await window.api.getConfig()
    console.log('App initialized:', appConfig)
  } catch (err) {
    console.error('Failed to initialize app config:', err)
  }
}

function setupUpdateListeners() {
  window.api.onUpdateStatus((message) => {
    console.log('Update status:', message)
  })

  window.api.onUpdateReady((version) => {
    showUpdateBanner(version)
  })
}

function showUpdateBanner(version) {
  const banner = document.createElement('div')
  banner.className = 'update-banner'
  banner.innerHTML = `
    <span>🎉 Update v${version} is ready!</span>
    <button onclick="window.api.restartApp()">Restart Now</button>
    <button onclick="this.parentElement.remove()">Later</button>
  `
  document.body.prepend(banner)
}

async function send() {
  const input = document.getElementById('input')
  const message = input.value.trim()
  if (!message) return

  append('user', message)
  input.value = ''

  const typing = append('ai', 'Typing...')

  const reply = await window.api.sendMessage(message)
  typing.innerHTML = formatMessage(reply)
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

function append(type, text) {
  const chatBox = document.getElementById('chat-box')
  const msg = document.createElement('div')
  msg.classList.add('message', type)
  msg.innerHTML = formatMessage(text)
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
      "<p class='error'>Failed to load snippets. Is the backend running?</p>"
  }
}

function renderSnippets(snippets) {
  const container = document.getElementById('snippets-list')
  container.innerHTML = snippets.map(s => `
    <div class="card snippet-card" onclick="copySnippet('${s.id}')">
      <h3>${s.name}</h3>
      <div class="tags">${s.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
      <pre><code>${escapeHtml(s.code.substring(0, 150))}${s.code.length > 150 ? '...' : ''}</code></pre>
      <button class="copy-btn">📋 Copy Code</button>
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
      "<p class='error'>Failed to load resources. Is the backend running?</p>"
  }
}

function showResourceTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.toLowerCase() === tab)
  })

  const content = document.getElementById('resources-content')

  if (tab === 'rules') {
    content.innerHTML = `
      <div class="resource-card">
        <h3>📜 Hackathon Rules</h3>
        <ul>${resourcesData.rules?.map(r => `<li>${r}</li>`).join('') || ''}</ul>
      </div>
    `
  } else if (tab === 'timeline') {
    content.innerHTML = `
      <div class="resource-card">
        <h3>⏰ Timeline</h3>
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
        <h3>🔌 Available APIs</h3>
        <div class="api-grid">
          ${Object.entries(apis).map(([key, api]) => `
            <div class="api-card">
              <h4>${api.name}</h4>
              <p>${api.description}</p>
              <a href="${api.docs}" target="_blank">📖 Documentation</a>
            </div>
          `).join('')}
        </div>
      </div>
    `
  } else if (tab === 'judging') {
    content.innerHTML = `
      <div class="resource-card">
        <h3>⚖️ Judging Criteria</h3>
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
        <h3>🏆 Prizes</h3>
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
      "<p class='error'>Failed to load FAQs. Is the backend running?</p>"
  }
}

function renderFaqs(faqs) {
  const container = document.getElementById('faq-list')
  container.innerHTML = faqs.map(f => `
    <div class="faq-card" onclick="toggleFaq(this)">
      <div class="faq-question">
        <span class="faq-icon">▶</span>
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

function showToast(message) {
  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.textContent = message
  document.body.appendChild(toast)
  setTimeout(() => toast.classList.add('show'), 10)
  setTimeout(() => {
    toast.classList.remove('show')
    setTimeout(() => toast.remove(), 300)
  }, 2000)
}
