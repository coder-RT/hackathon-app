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
          type: {
            type: "string",
            description: "Project type (fastapi, react, express, flask, etc)"
          }
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
      description: "Get a pre-defined code snippet or template by keyword or technology. Use this for code examples, starter templates, and boilerplate code.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Technology or keyword to search for (e.g., 'fastapi', 'react', 'express', 'jwt', 'mongodb', 'docker', 'websocket')"
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
      description: "Find solutions to common development errors and issues. Use this when user describes an error or problem.",
      parameters: {
        type: "object",
        properties: {
          error_description: {
            type: "string",
            description: "Description of the error or keywords from error message (e.g., 'cors', 'module not found', 'port in use', '401')"
          }
        },
        required: ["error_description"]
      }
    }
  }
]

function findSnippet(query) {
  const q = query.toLowerCase()
  
  for (const [key, snippet] of Object.entries(snippets)) {
    if (key.includes(q)) return snippet
    if (snippet.tags.some(tag => tag.includes(q) || q.includes(tag))) return snippet
    if (snippet.name.toLowerCase().includes(q)) return snippet
  }
  
  const matches = Object.values(snippets).filter(s =>
    s.tags.some(tag => q.includes(tag) || tag.includes(q))
  )
  
  return matches.length > 0 ? matches[0] : null
}

function findFaq(errorDescription) {
  const q = errorDescription.toLowerCase()
  
  for (const [key, faq] of Object.entries(faqs)) {
    if (key.includes(q)) return faq
    if (faq.keywords.some(kw => q.includes(kw))) return faq
  }
  
  const words = q.split(/\s+/)
  for (const faq of Object.values(faqs)) {
    for (const word of words) {
      if (word.length > 3 && faq.keywords.some(kw => kw.includes(word) || word.includes(kw))) {
        return faq
      }
    }
  }
  
  return null
}

async function executeTool(name, args) {
  if (name === "create_project") {
    const snippet = findSnippet(args.type)
    if (snippet) {
      return `✅ Created ${args.type} project!\n\n**${snippet.name}**\n\`\`\`\n${snippet.code}\n\`\`\``
    }
    return `✅ Created ${args.type} project with basic structure`
  }

  if (name === "deploy_app") {
    return `🚀 ${args.name} deployed at https://${args.name.toLowerCase().replace(/\s+/g, "-")}.demo-app.com`
  }

  if (name === "get_code_snippet") {
    const snippet = findSnippet(args.query)
    if (snippet) {
      return `📝 **${snippet.name}**\n\nTags: ${snippet.tags.join(", ")}\n\n\`\`\`\n${snippet.code}\n\`\`\``
    }
    
    const available = Object.values(snippets).map(s => s.name).join(", ")
    return `No snippet found for "${args.query}". Available snippets: ${available}`
  }

  if (name === "get_hackathon_info") {
    const category = args.category
    
    if (category === "all") {
      return `📋 **${resources.hackathon.name}**\n\n` +
        `**Theme:** ${resources.hackathon.theme}\n` +
        `**Duration:** ${resources.hackathon.duration}\n\n` +
        `**Rules:**\n${resources.rules.map(r => `• ${r}`).join("\n")}\n\n` +
        `**Timeline:**\n${resources.timeline.map(t => `• ${t.time}: ${t.event}`).join("\n")}`
    }
    
    if (category === "rules") {
      return `📜 **Hackathon Rules**\n\n${resources.rules.map((r, i) => `${i + 1}. ${r}`).join("\n")}`
    }
    
    if (category === "timeline") {
      return `⏰ **Timeline**\n\n${resources.timeline.map(t => `**${t.time}** - ${t.event}`).join("\n")}`
    }
    
    if (category === "apis") {
      const apiList = Object.entries(resources.apis).map(([key, api]) =>
        `**${api.name}**\n• URL: ${api.url}\n• Docs: ${api.docs}\n• ${api.description}`
      ).join("\n\n")
      return `🔌 **Available APIs**\n\n${apiList}`
    }
    
    if (category === "judging") {
      const criteria = resources.judging_criteria.map(c =>
        `**${c.criteria}** (${c.weight})\n${c.description}`
      ).join("\n\n")
      return `⚖️ **Judging Criteria**\n\n${criteria}`
    }
    
    if (category === "prizes") {
      return `🏆 **Prizes**\n\n${resources.prizes.map(p => `**${p.place}:** ${p.prize}`).join("\n")}`
    }
    
    if (category === "contacts") {
      return `📞 **Contacts**\n\n` +
        `• Organizers: ${resources.contacts.organizers}\n` +
        `• Tech Support: ${resources.contacts.technical_support}\n` +
        `• Slack: ${resources.contacts.slack_channel}`
    }
    
    return "Invalid category"
  }

  if (name === "troubleshoot") {
    const faq = findFaq(args.error_description)
    if (faq) {
      return `🔧 **Problem:** ${faq.problem}\n\n**Solution:**\n${faq.solution}`
    }
    return `No specific solution found for "${args.error_description}". Try describing the error message or keywords more specifically.`
  }

  return "Unknown tool"
}

const systemPrompt = `You are a helpful hackathon assistant for the "${resources.hackathon.name}" event.

Your capabilities:
1. **Code Snippets**: Use get_code_snippet to provide pre-defined code templates (saves tokens vs generating code)
2. **Hackathon Info**: Use get_hackathon_info to retrieve rules, timeline, APIs, judging criteria, and prizes
3. **Troubleshooting**: Use troubleshoot when users describe errors or issues
4. **Project Creation**: Use create_project to scaffold new projects
5. **Deployment**: Use deploy_app to deploy applications

IMPORTANT: Always prefer using tools to provide accurate, pre-defined information instead of generating responses from scratch. This ensures consistency and saves resources.

When users ask for code examples, templates, or starter code, use get_code_snippet.
When users have errors or problems, use troubleshoot.
When users ask about rules, deadlines, APIs, or hackathon details, use get_hackathon_info.

Be concise, helpful, and encouraging. Guide beginners through the process step by step.`

app.post("/chat", async (req, res) => {
  try {
    const { message } = req.body

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
      const toolResult = await executeTool(
        toolCall.function.name,
        JSON.parse(toolCall.function.arguments)
      )
      return res.json({ reply: toolResult })
    }

    return res.json({ reply: msg.content })
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

app.listen(3000, () => {
  console.log("Backend running on http://localhost:3000")
})
