require('dotenv').config()
const express = require("express")
const cors = require("cors")
const OpenAI = require("openai")
const fs = require("fs")
const path = require("path")

const app = express()
app.use(cors())
app.use(express.json())

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL
})

const dataDir = path.join(__dirname, "data")
const snippets = JSON.parse(fs.readFileSync(path.join(dataDir, "snippets.json"), "utf-8"))
const resources = JSON.parse(fs.readFileSync(path.join(dataDir, "resources.json"), "utf-8"))
const faqs = JSON.parse(fs.readFileSync(path.join(dataDir, "faqs.json"), "utf-8"))

function loadConfig() {
  try {
    const configPath = path.join(__dirname, "..", "config.json")
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, "utf-8"))
    }
  } catch (err) {
    console.error("Failed to load config.json:", err.message)
  }
  return {}
}

const appConfig = loadConfig()

const routingConfig = {
  llmTags: appConfig.routing?.llmTags || ["generate:", "GENERATE:", "@llm", "@LLM", "@ai", "@AI", "gen:"],
  snippetTags: appConfig.routing?.snippetTags || ["snippet:", "SNIPPET:", "@snippet", "@code"]
}

function detectRoutingTag(message) {
  const trimmed = message.trim()
  
  for (const tag of routingConfig.llmTags) {
    if (trimmed.toLowerCase().startsWith(tag.toLowerCase())) {
      return { mode: "llm", cleanMessage: trimmed.slice(tag.length).trim() }
    }
  }
  
  for (const tag of routingConfig.snippetTags) {
    if (trimmed.toLowerCase().startsWith(tag.toLowerCase())) {
      return { mode: "snippets", cleanMessage: trimmed.slice(tag.length).trim() }
    }
  }
  
  return { mode: null, cleanMessage: message }
}

const tools = [
  {
    type: "function",
    function: {
      name: "create_project",
      description: "Create a starter project with boilerplate code",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", description: "Project type (fastapi, react, express, flask, etc)" }
        },
        required: ["type"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "deploy_app",
      description: "Deploy an application to the cloud",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Application name" }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_code_snippet",
      description: "Get a pre-defined code snippet or template. IMPORTANT: Always specify the language parameter when the user mentions a specific language.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "What the user wants (e.g., 'file upload', 'crud api', 'authentication')" },
          language: { 
            type: "string", 
            description: "Programming language or framework. REQUIRED if user specifies one. Options: typescript, javascript, python, react, express, fastapi, flask, nextjs, prisma, etc."
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_hackathon_info",
      description: "Get hackathon information including rules, timeline, APIs, judging criteria, and prizes",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: ["rules", "timeline", "apis", "judging", "prizes", "contacts", "all"],
            description: "Category of information to retrieve"
          }
        },
        required: ["category"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "troubleshoot",
      description: "Find solutions to common development errors and issues",
      parameters: {
        type: "object",
        properties: {
          error_description: { type: "string", description: "Description of the error or keywords" }
        },
        required: ["error_description"]
      }
    }
  }
]

const LANGUAGE_ALIASES = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  py: 'python',
  node: 'nodejs',
  'node.js': 'nodejs'
}

const DETECTABLE_LANGUAGES = [
  'typescript', 'javascript', 'python', 'react', 'express', 
  'fastapi', 'flask', 'nextjs', 'next.js', 'prisma', 'zod',
  'fastify', 'nodejs', 'node', 'ts', 'js', 'py'
]

function detectLanguage(query) {
  const q = query.toLowerCase()
  const words = q.split(/\s+/)
  
  for (const word of words) {
    if (DETECTABLE_LANGUAGES.includes(word)) {
      return normalizeLanguage(word)
    }
  }
  
  for (const lang of DETECTABLE_LANGUAGES) {
    if (q.includes(lang)) {
      return normalizeLanguage(lang)
    }
  }
  
  return null
}

function normalizeLanguage(lang) {
  if (!lang) return null
  const lower = lang.toLowerCase().trim()
  return LANGUAGE_ALIASES[lower] || lower
}

function snippetMatchesLanguage(snippet, language) {
  if (!language) return true
  const tags = snippet.tags.map(t => t.toLowerCase())
  const normalizedLang = normalizeLanguage(language)
  
  return tags.some(tag => {
    const normalizedTag = normalizeLanguage(tag)
    return normalizedTag === normalizedLang || 
           tag.includes(normalizedLang) || 
           normalizedLang.includes(tag)
  })
}

function scoreSnippet(snippet, key, queryWords, language = null) {
  let score = 0
  const name = snippet.name.toLowerCase()
  const tags = snippet.tags.map(t => t.toLowerCase())
  
  if (language && !snippetMatchesLanguage(snippet, language)) {
    return -1
  }
  
  if (language && snippetMatchesLanguage(snippet, language)) {
    score += 50
  }
  
  for (const word of queryWords) {
    if (word.length < 2) continue
    
    if (key.includes(word)) score += 10
    if (name.includes(word)) score += 8
    
    for (const tag of tags) {
      if (tag === word) score += 15
      else if (tag.includes(word)) score += 5
      else if (word.includes(tag) && tag.length >= 4) score += 3
    }
  }
  
  return score
}

function findSnippetWithScore(query, language = null, minScore = 10) {
  const q = query.toLowerCase()
  const queryWords = q.split(/\s+/).filter(w => w.length > 1)
  
  let bestMatch = null
  let bestScore = 0
  
  for (const [key, snippet] of Object.entries(snippets)) {
    const score = scoreSnippet(snippet, key, queryWords, language)
    if (score > bestScore) {
      bestScore = score
      bestMatch = { ...snippet, id: key, score }
    }
  }
  
  if (bestScore >= minScore) {
    return bestMatch
  }
  
  return null
}

function findAllSnippets(query, language = null, limit = 5) {
  const q = query.toLowerCase()
  const queryWords = q.split(/\s+/).filter(w => w.length > 1)
  
  const scored = Object.entries(snippets)
    .map(([key, snippet]) => ({
      ...snippet,
      id: key,
      score: scoreSnippet(snippet, key, queryWords, language)
    }))
    .filter(s => s.score >= 0)
  
  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

function findFaq(errorDescription) {
  const q = errorDescription.toLowerCase()
  const words = q.split(/\s+/).filter(w => w.length > 2)
  
  let bestMatch = null
  let bestScore = 0
  
  for (const [key, faq] of Object.entries(faqs)) {
    let score = 0
    
    if (key.includes(q) || q.includes(key)) score += 20
    
    for (const kw of faq.keywords) {
      if (q.includes(kw)) score += 10
      for (const word of words) {
        if (kw.includes(word) || word.includes(kw)) score += 3
      }
    }
    
    if (score > bestScore) {
      bestScore = score
      bestMatch = faq
    }
  }
  
  return bestScore >= 5 ? bestMatch : null
}

async function executeTool(name, args) {
  if (name === "create_project") {
    const snippet = findSnippetWithScore(args.type, null, 8)
    if (snippet) {
      return {
        text: `Created ${args.type} project!\n\n**${snippet.name}**\n\`\`\`\n${snippet.code}\n\`\`\``,
        source: "snippet",
        snippetId: snippet.id
      }
    }
    return { text: `Created ${args.type} project with basic structure`, source: "tool" }
  }

  if (name === "deploy_app") {
    return {
      text: `🚀 ${args.name} deployed at https://${args.name.toLowerCase().replace(/\s+/g, "-")}.demo-app.com`,
      source: "tool"
    }
  }

  if (name === "get_code_snippet") {
    const language = args.language || null
    const snippet = findSnippetWithScore(args.query, language, 10)
    
    if (snippet) {
      return {
        text: `**${snippet.name}**\n\nTags: ${snippet.tags.join(", ")}\n\n\`\`\`\n${snippet.code}\n\`\`\``,
        source: "snippet",
        snippetId: snippet.id,
        confidence: snippet.score
      }
    }
    
    const suggestions = findAllSnippets(args.query, language, 3)
    if (suggestions.length > 0) {
      const suggestionText = suggestions.map(s => `• ${s.name} (${s.tags.slice(0, 3).join(", ")})`).join("\n")
      return {
        text: `No exact match for "${args.query}"${language ? ` in ${language}` : ""}. Did you mean:\n${suggestionText}`,
        source: "suggestions",
        suggestions: suggestions.map(s => s.id)
      }
    }
    
    if (language) {
      const anySnippets = findAllSnippets(args.query, null, 3)
      if (anySnippets.length > 0) {
        const suggestionText = anySnippets.map(s => `• ${s.name} (${s.tags.slice(0, 3).join(", ")})`).join("\n")
        return {
          text: `No ${language} snippets found for "${args.query}". Available in other languages:\n${suggestionText}`,
          source: "suggestions",
          suggestions: anySnippets.map(s => s.id)
        }
      }
    }
    
    return { text: null, source: "none" }
  }

  if (name === "get_hackathon_info") {
    const category = args.category
    let text = ""
    
    if (category === "all") {
      text = `📋 **${resources.hackathon.name}**\n\n` +
        `**Theme:** ${resources.hackathon.theme}\n` +
        `**Duration:** ${resources.hackathon.duration}\n\n` +
        `**Rules:**\n${resources.rules.map(r => `• ${r}`).join("\n")}\n\n` +
        `**Timeline:**\n${resources.timeline.map(t => `• ${t.time}: ${t.event}`).join("\n")}`
    } else if (category === "rules") {
      text = `📜 **Hackathon Rules**\n\n${resources.rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}`
    } else if (category === "timeline") {
      text = `⏰ **Timeline**\n\n${resources.timeline.map(t => `**${t.time}** - ${t.event}`).join("\n")}`
    } else if (category === "apis") {
      const apiList = Object.entries(resources.apis).map(([key, api]) =>
        `**${api.name}**\n• URL: ${api.url}\n• Docs: ${api.docs}\n• ${api.description}`
      ).join("\n\n")
      text = `🔌 **Available APIs**\n\n${apiList}`
    } else if (category === "judging") {
      const criteria = resources.judging_criteria.map(c =>
        `**${c.criteria}** (${c.weight})\n${c.description}`
      ).join("\n\n")
      text = `⚖️ **Judging Criteria**\n\n${criteria}`
    } else if (category === "prizes") {
      text = `🏆 **Prizes**\n\n${resources.prizes.map(p => `**${p.place}:** ${p.prize}`).join("\n")}`
    } else if (category === "contacts") {
      text = `📞 **Contacts**\n\n` +
        `• Organizers: ${resources.contacts.organizers}\n` +
        `• Tech Support: ${resources.contacts.technical_support}\n` +
        `• Slack: ${resources.contacts.slack_channel}`
    }
    
    return { text, source: "resource" }
  }

  if (name === "troubleshoot") {
    const faq = findFaq(args.error_description)
    if (faq) {
      return {
        text: `🔧 **Problem:** ${faq.problem}\n\n**Solution:**\n${faq.solution}`,
        source: "faq"
      }
    }
    return { text: null, source: "none" }
  }

  return { text: "Unknown tool", source: "error" }
}

const systemPrompt = `You are a helpful hackathon assistant for the "${resources.hackathon.name}" event.

Your capabilities:
1. **Code Snippets**: Use get_code_snippet for pre-defined code templates
2. **Hackathon Info**: Use get_hackathon_info for rules, timeline, APIs, prizes
3. **Troubleshooting**: Use troubleshoot for common errors
4. **Project Creation**: Use create_project to scaffold projects
5. **Deployment**: Use deploy_app to deploy applications

IMPORTANT RULES:
- When users ask for code, ALWAYS use get_code_snippet first before generating code yourself.
- When users specify a programming language (TypeScript, Python, JavaScript, etc.), you MUST pass it as the "language" parameter to get_code_snippet.
- If a user says "no" or corrects you about the language, pay attention and use the correct language parameter.
- Common language keywords to detect: typescript/ts, javascript/js, python/py, react, express, fastapi, flask, nextjs, etc.

Examples:
- "file upload in typescript" → get_code_snippet(query: "file upload", language: "typescript")
- "python api" → get_code_snippet(query: "api", language: "python")
- "react component" → get_code_snippet(query: "component", language: "react")

Be concise, helpful, and encouraging. If no snippet matches the exact criteria, offer alternatives or generate code.`

app.post("/chat", async (req, res) => {
  try {
    const { message: rawMessage, mode: requestedMode = "auto" } = req.body
    
    const { mode: tagMode, cleanMessage } = detectRoutingTag(rawMessage)
    const mode = tagMode || requestedMode
    const message = tagMode ? cleanMessage : rawMessage
    
    if (mode === "snippets") {
      const detectedLang = detectLanguage(message)
      const snippet = findSnippetWithScore(message, detectedLang, 5)
      
      if (snippet) {
        return res.json({
          reply: `**${snippet.name}**\n\nTags: ${snippet.tags.join(", ")}\n\n\`\`\`\n${snippet.code}\n\`\`\``,
          mode: "snippets",
          source: "snippet",
          snippetId: snippet.id
        })
      }
      
      const suggestions = findAllSnippets(message, detectedLang, 5)
      if (suggestions.length > 0) {
        return res.json({
          reply: `No exact match${detectedLang ? ` for ${detectedLang}` : ""}. Available snippets:\n${suggestions.map(s => `• **${s.name}** (${s.tags.slice(0, 3).join(", ")})`).join("\n")}`,
          mode: "snippets",
          source: "suggestions",
          suggestions: suggestions.map(s => ({ id: s.id, name: s.name }))
        })
      }
      
      if (detectedLang) {
        const anySnippets = findAllSnippets(message, null, 5)
        if (anySnippets.length > 0) {
          return res.json({
            reply: `No ${detectedLang} snippets found. Available in other languages:\n${anySnippets.map(s => `• **${s.name}** (${s.tags.slice(0, 3).join(", ")})`).join("\n")}`,
            mode: "snippets",
            source: "suggestions",
            suggestions: anySnippets.map(s => ({ id: s.id, name: s.name }))
          })
        }
      }
      
      return res.json({
        reply: "No matching snippets found. Try different keywords or switch to AI mode.",
        mode: "snippets",
        source: "none"
      })
    }
    
    if (mode === "llm") {
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a helpful hackathon assistant. Generate code and provide guidance. Be concise." },
          { role: "user", content: message }
        ]
      })
      
      return res.json({
        reply: response.choices[0].message.content,
        mode: "llm",
        source: "generated"
      })
    }
    
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      tools,
      tool_choice: "auto"
    })

    const msg = response.choices[0].message

    if (msg.tool_calls) {
      const toolCall = msg.tool_calls[0]
      const result = await executeTool(
        toolCall.function.name,
        JSON.parse(toolCall.function.arguments)
      )
      
      if (result.text) {
        return res.json({
          reply: result.text,
          mode: "auto",
          source: result.source,
          snippetId: result.snippetId
        })
      }
      
      const fallbackResponse = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are a helpful hackathon assistant. Generate the requested code or information." },
          { role: "user", content: message }
        ]
      })
      
      return res.json({
        reply: fallbackResponse.choices[0].message.content,
        mode: "auto",
        source: "generated"
      })
    }

    return res.json({
      reply: msg.content,
      mode: "auto",
      source: "generated"
    })
  } catch (err) {
    console.error("Chat error:", err)
    res.status(500).json({ error: err.message })
  }
})

app.get("/snippets", (req, res) => {
  const snippetList = Object.entries(snippets).map(([id, s]) => ({
    id,
    name: s.name,
    tags: s.tags,
    code: s.code
  }))
  res.json(snippetList)
})

app.get("/snippet/:id", (req, res) => {
  const snippet = snippets[req.params.id]
  if (!snippet) {
    return res.status(404).json({ error: "Snippet not found" })
  }
  res.json({ id: req.params.id, ...snippet })
})

app.get("/resources", (req, res) => {
  res.json(resources)
})

app.get("/faqs", (req, res) => {
  const faqList = Object.entries(faqs).map(([id, f]) => ({
    id,
    problem: f.problem,
    solution: f.solution,
    keywords: f.keywords
  }))
  res.json(faqList)
})

app.get("/quick-actions", (req, res) => {
  const actions = [
    { id: "fastapi-basic", label: "FastAPI Starter", icon: "🐍", category: "backend" },
    { id: "express-basic", label: "Express Starter", icon: "🟢", category: "backend" },
    { id: "typescript-express-basic", label: "TypeScript Express", icon: "🔷", category: "backend" },
    { id: "react-component", label: "React Component", icon: "⚛️", category: "frontend" },
    { id: "typescript-react-file-upload", label: "React Upload (TS)", icon: "📁", category: "frontend" },
    { id: "fastapi-file-upload", label: "File Upload (Python)", icon: "📁", category: "feature" },
    { id: "typescript-express-file-upload", label: "File Upload (TS)", icon: "📁", category: "feature" },
    { id: "jwt-auth", label: "JWT Auth", icon: "🔐", category: "security" },
    { id: "typescript-zod-validation", label: "Zod Validation", icon: "✅", category: "security" },
    { id: "mongodb-connect", label: "MongoDB Setup", icon: "🍃", category: "database" },
    { id: "typescript-prisma-crud", label: "Prisma CRUD (TS)", icon: "💎", category: "database" },
    { id: "docker-compose", label: "Docker Compose", icon: "🐳", category: "devops" },
    { id: "rules", label: "Hackathon Rules", icon: "📜", category: "info", type: "resource" },
    { id: "timeline", label: "Timeline", icon: "⏰", category: "info", type: "resource" },
    { id: "apis", label: "Available APIs", icon: "🔌", category: "info", type: "resource" },
    { id: "prizes", label: "Prizes", icon: "🏆", category: "info", type: "resource" }
  ]
  res.json(actions)
})

app.get("/routing-config", (req, res) => {
  res.json({
    llmTags: routingConfig.llmTags,
    snippetTags: routingConfig.snippetTags
  })
})

app.listen(3000, () => {
  console.log("Backend running on http://localhost:3000")
})
