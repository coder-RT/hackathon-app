# Tooling Flow Documentation

This document explains how the AI assistant uses OpenAI's function calling (tools) to retrieve pre-defined code snippets instead of generating them, saving tokens and ensuring consistency.

## Overview

The app uses **OpenAI function calling** to let the LLM decide when to retrieve pre-defined content vs generate new content. This hybrid approach:

- **Saves output tokens** (code is local, not generated)
- **Ensures consistency** (same snippet every time)
- **Faster responses** (no generation time for code)

---

## Mode Detection

When a user sends a message, the system first checks for routing tags:

| Prefix | Mode | Behavior |
|--------|------|----------|
| `generate:`, `@llm`, `@ai`, `gen:` | LLM | Forces direct LLM generation |
| `snippet:`, `@code` | Snippets | Searches local snippets only |
| (none) | Auto | LLM decides via function calling |

These tags are configurable in `config.json` under `routing.llmTags` and `routing.snippetTags`.

---

## Three Modes

| Mode | What Happens |
|------|-------------|
| **snippets** | Searches local `snippets.json` directly, no LLM call |
| **llm** | Calls OpenAI directly without tools, generates code |
| **auto** | Calls OpenAI **with tools**, LLM decides what to do |

---

## Available Tools

| Tool | Purpose | Data Source |
|------|---------|-------------|
| `get_code_snippet` | Retrieve pre-defined code snippets | `snippets.json` |
| `get_hackathon_info` | Get rules, timeline, APIs, prizes | `resources.json` |
| `troubleshoot` | Find solutions to common errors | `faqs.json` |
| `create_project` | Scaffold a new project | Shell commands |
| `deploy_app` | Deploy to cloud | Shell commands |

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER INPUT                                      │
│                    "show me file upload in typescript"                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         POST /chat endpoint                                  │
│                         (backend/server.js)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      detectRoutingTag(message)                               │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Check for prefixes:                                                    │ │
│  │   • "generate:", "@llm", "@ai" → force LLM mode                        │ │
│  │   • "snippet:", "@code"        → force Snippets mode                   │ │
│  │   • no prefix                  → use requestedMode from UI             │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
          ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
          │   SNIPPETS  │    │     LLM     │    │    AUTO     │
          │    MODE     │    │    MODE     │    │    MODE     │
          └─────────────┘    └─────────────┘    └─────────────┘
                    │                 │                 │
                    ▼                 ▼                 ▼
┌───────────────────────┐ ┌───────────────────┐ ┌───────────────────────────┐
│ detectLanguage()      │ │ OpenAI API        │ │ OpenAI API                │
│ findSnippetWithScore()│ │ (NO tools)        │ │ (WITH tools)              │
│                       │ │                   │ │                           │
│ Search snippets.json  │ │ Direct generation │ │ tools: [                  │
│ locally               │ │ No function calls │ │   get_code_snippet,       │
│                       │ │                   │ │   get_hackathon_info,     │
│ NO API CALL           │ │                   │ │   troubleshoot,           │
│                       │ │                   │ │   create_project,         │
│                       │ │                   │ │   deploy_app              │
│                       │ │                   │ │ ]                         │
│                       │ │                   │ │ tool_choice: "auto"       │
└───────────────────────┘ └───────────────────┘ └───────────────────────────┘
          │                       │                         │
          ▼                       ▼                         ▼
┌───────────────────────┐ ┌───────────────────┐ ┌───────────────────────────┐
│ Return snippet        │ │ Return generated  │ │ LLM decides:              │
│ source: "snippet"     │ │ source: "generated│ │   • Call a tool? OR       │
│                       │ │                   │ │   • Generate directly?    │
└───────────────────────┘ └───────────────────┘ └───────────────────────────┘
                                                            │
                                          ┌─────────────────┴─────────────────┐
                                          │                                   │
                                          ▼                                   ▼
                            ┌─────────────────────────┐         ┌─────────────────────────┐
                            │   msg.tool_calls exists │         │   No tool_calls         │
                            │   (LLM wants to use     │         │   (LLM answered         │
                            │    a tool)              │         │    directly)            │
                            └─────────────────────────┘         └─────────────────────────┘
                                          │                                   │
                                          ▼                                   ▼
                            ┌─────────────────────────┐         ┌─────────────────────────┐
                            │   handleToolCall()      │         │   Return LLM response   │
                            │                         │         │   source: "generated"   │
                            │   Switch on tool name:  │         └─────────────────────────┘
                            │   ├─ get_code_snippet   │
                            │   ├─ get_hackathon_info │
                            │   ├─ troubleshoot       │
                            │   ├─ create_project     │
                            │   └─ deploy_app         │
                            └─────────────────────────┘
                                          │
          ┌───────────────┬───────────────┼───────────────┬───────────────┐
          ▼               ▼               ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│get_code_    │  │get_hackathon│  │troubleshoot │  │create_      │  │deploy_app   │
│snippet      │  │_info        │  │             │  │project      │  │             │
├─────────────┤  ├─────────────┤  ├─────────────┤  ├─────────────┤  ├─────────────┤
│Search       │  │Read from    │  │Search       │  │Return shell │  │Return shell │
│snippets.json│  │resources.   │  │faqs.json    │  │commands     │  │commands     │
│             │  │json         │  │             │  │             │  │             │
│scoreSnippet │  │             │  │findFaq()    │  │             │  │             │
│+ language   │  │             │  │             │  │             │  │             │
│filtering    │  │             │  │             │  │             │  │             │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
          │               │               │               │               │
          └───────────────┴───────────────┼───────────────┴───────────────┘
                                          │
                                          ▼
                            ┌─────────────────────────┐
                            │   Tool result returned  │
                            │   to server             │
                            │                         │
                            │   { text, source }      │
                            └─────────────────────────┘
                                          │
                                          ▼
                            ┌─────────────────────────┐
                            │   If tool found result: │
                            │   Return to user        │
                            │                         │
                            │   If no result:         │
                            │   Make follow-up LLM    │
                            │   call to generate      │
                            └─────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            RESPONSE TO USER                                  │
│  {                                                                          │
│    reply: "...",                                                            │
│    mode: "auto" | "snippets" | "llm",                                       │
│    source: "snippet" | "resource" | "faq" | "generated" | "tool"            │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ELECTRON RENDERER                                    │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ Display response with badge indicating source:                         │ │
│  │   • 📦 Snippet    (pre-defined code, saved tokens)                     │ │
│  │   • 🤖 Generated  (LLM created the response)                           │ │
│  │   • 📚 Resource   (hackathon info from resources.json)                 │ │
│  │   • ❓ FAQ        (from faqs.json)                                     │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Snippet Search Algorithm

When `get_code_snippet` is called, the server uses a scoring algorithm:

### Scoring Factors

| Factor | Points |
|--------|--------|
| Exact key match | 100 |
| Name contains query word | 20 per word |
| Tag exact match | 15 per tag |
| Tag partial match | 5 per tag |
| Language match | 50 |
| Language mismatch (when specified) | -1 (filtered out) |

### Language Detection

The system detects languages from user queries:

```javascript
const LANGUAGE_ALIASES = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  py: 'python',
  node: 'nodejs'
}
```

---

## Response Sources

Each response includes a `source` field indicating where the content came from:

| Source | Meaning |
|--------|---------|
| `snippet` | Pre-defined code from `snippets.json` |
| `resource` | Hackathon info from `resources.json` |
| `faq` | Troubleshooting from `faqs.json` |
| `generated` | LLM-generated content |
| `tool` | Generic tool execution result |
| `suggestions` | List of similar snippets (no exact match) |

---

## Adding New Snippets

To add a new snippet, edit `backend/data/snippets.json`:

```json
{
  "my-snippet-key": {
    "name": "My Snippet Name",
    "tags": ["language", "framework", "feature", "keyword"],
    "code": "// Your code here\nfunction example() {\n  return 'Hello';\n}"
  }
}
```

**Tips:**
- Use descriptive tags for better search matching
- Include language tags (`typescript`, `python`, etc.)
- Include framework tags (`express`, `react`, `fastapi`, etc.)
- Include feature tags (`file-upload`, `auth`, `crud`, etc.)

---

## Configuration

### Routing Tags (`config.json`)

```json
{
  "routing": {
    "llmTags": ["generate:", "@llm", "@ai", "gen:"],
    "snippetTags": ["snippet:", "@code"]
  }
}
```

### System Prompt

The LLM is instructed via system prompt to:
1. Always try `get_code_snippet` first before generating code
2. Pass the `language` parameter when user specifies one
3. Offer alternatives if no exact match is found
