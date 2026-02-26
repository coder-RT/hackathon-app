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
      description: "Get a pre-defined code snippet or template by keyword or technology",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Technology or keyword (e.g., 'fastapi file upload', 'react component', 'jwt auth')" }
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

function scoreSnippet(snippet, key, queryWords) {
  let score = 0
  const name = snippet.name.toLowerCase()
  const tags = snippet.tags.map(t => t.toLowerCase())
  
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

function findSnippetWithScore(query, minScore = 10) {
  const q = query.toLowerCase()
  const queryWords = q.split(/\s+/).filter(w => w.length > 1)
  
  let bestMatch = null
  let bestScore = 0
  
  for (const [key, snippet] of Object.entries(snippets)) {
    const score = scoreSnippet(snippet, key, queryWords)
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

function findAllSnippets(query, limit = 5) {
  const q = query.toLowerCase()
  const queryWords = q.split(/\s+/).filter(w => w.length > 1)
  
  const scored = Object.entries(snippets).map(([key, snippet]) => ({
    ...snippet,
    id: key,
    score: scoreSnippet(snippet, key, queryWords)
  }))
  
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
    const snippet = findSnippetWithScore(args.type, 8)
    if (snippet) {
      return {
        text: `✅ Created ${args.type} project!\n\n**${snippet.name}**\n\`\`\`\n${snippet.code}\n\`\`\``,
        source: "snippet",
        snippetId: snippet.id
      }
    }
    return { text: `✅ Created ${args.type} project with basic structure`, source: "tool" }
  }

  if (name === "deploy_app") {
    return {
      text: `🚀 ${args.name} deployed at https://${args.name.toLowerCase().replace(/\s+/g, "-")}.demo-app.com`,
      source: "tool"
    }
  }

  if (name === "get_code_snippet") {
    const snippet = findSnippetWithScore(args.query, 10)
    if (snippet) {
      return {
        text: `📝 **${snippet.name}**\n\nTags: ${snippet.tags.join(", ")}\n\n\`\`\`\n${snippet.code}\n\`\`\``,
        source: "snippet",
        snippetId: snippet.id,
        confidence: snippet.score
      }
    }
    
    const suggestions = findAllSnippets(args.query, 3)
    if (suggestions.length > 0) {
      const suggestionText = suggestions.map(s => `• ${s.name}`).join("\n")
      return {
        text: `No exact match for "${args.query}". Did you mean:\n${suggestionText}`,
        source: "snippet",
        suggestions: suggestions.map(s => s.id)
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

When users ask for code, use get_code_snippet first. If no snippet matches, generate the code yourself.
Be concise, helpful, and encouraging.`

app.post("/chat", async (req, res) => {
  try {
    const { message, mode = "auto" } = req.body
    
    if (mode === "snippets") {
      const snippet = findSnippetWithScore(message, 5)
      if (snippet) {
        return res.json({
          reply: `📝 **${snippet.name}**\n\nTags: ${snippet.tags.join(", ")}\n\n\`\`\`\n${snippet.code}\n\`\`\``,
          mode: "snippets",
          source: "snippet",
          snippetId: snippet.id
        })
      }
      
      const suggestions = findAllSnippets(message, 5)
      if (suggestions.length > 0) {
        return res.json({
          reply: `No exact match. Available snippets:\n${suggestions.map(s => `• **${s.name}** (${s.tags.slice(0, 3).join(", ")})`).join("\n")}`,
          mode: "snippets",
          source: "suggestions",
          suggestions: suggestions.map(s => ({ id: s.id, name: s.name }))
        })
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
    { id: "react-component", label: "React Component", icon: "⚛️", category: "frontend" },
    { id: "fastapi-file-upload", label: "File Upload (Python)", icon: "📁", category: "feature" },
    { id: "express-file-upload", label: "File Upload (Node)", icon: "📁", category: "feature" },
    { id: "jwt-auth", label: "JWT Auth", icon: "🔐", category: "security" },
    { id: "mongodb-connect", label: "MongoDB Setup", icon: "🍃", category: "database" },
    { id: "docker-compose", label: "Docker Compose", icon: "🐳", category: "devops" },
    { id: "rules", label: "Hackathon Rules", icon: "📜", category: "info", type: "resource" },
    { id: "timeline", label: "Timeline", icon: "⏰", category: "info", type: "resource" },
    { id: "apis", label: "Available APIs", icon: "🔌", category: "info", type: "resource" },
    { id: "prizes", label: "Prizes", icon: "🏆", category: "info", type: "resource" }
  ]
  res.json(actions)
})

app.listen(3000, () => {
  console.log("Backend running on http://localhost:3000")
})
