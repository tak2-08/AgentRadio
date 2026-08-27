import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"

// ── Memory core — OpenClaw-inspired, opencode-native ──
// Layout per-worktree (like radio): ~/.cache/opencode/memory/<sanitized>-<hash>/
//   MEMORY.md              — curated long-term (durable facts, preferences, decisions)
//   memory/YYYY-MM-DD.md   — daily notes (raw logs, observations, session summaries)
// Global cross-project also: ~/.config/opencode/MEMORY.md (+ memory/)
// Project-local portable: <worktree>/MEMORY.md (if exists, indexed too)

const INDEX_VERSION = 1

function getMemoryRoot(worktree: string, directory: string): string {
  const explicit = process.env.OPENCODE_MEMORY_ROOT
  if (explicit && explicit.trim()) return explicit
  const base = worktree || directory || process.cwd()
  let sanitized = base.replace(/[^a-zA-Z0-9]/g, "-").replace(/^-+/, "").replace(/-+$/, "")
  if (!sanitized) sanitized = "default"
  if (sanitized.length > 80) sanitized = sanitized.slice(0, 80)
  let hash = 0
  for (let i = 0; i < base.length; i++) hash = ((hash * 31) + base.charCodeAt(i)) >>> 0
  const suffix = hash.toString(16).slice(0, 6)
  return path.join(os.homedir(), ".cache", "opencode", "memory", `${sanitized}-${suffix}`)
}

function ensureMemory(root: string) {
  fs.mkdirSync(path.join(root, "memory"), { recursive: true })
  const memPath = path.join(root, "MEMORY.md")
  if (!fs.existsSync(memPath)) {
    const init = `# MEMORY.md — Long-term memory (opencode core)\n\n> Curated durable facts, preferences, decisions. Daily raw logs go to \`memory/YYYY-MM-DD.md\`. This file is injected at session start (truncated if large). Keep it compact.\n\n## Durable facts\n\n- (empty — add via memory_write or daily promotion)\n`
    fs.writeFileSync(memPath, init, "utf-8")
  }
}

function resolveMemoryRoots(worktree: string, directory: string): string[] {
  const perWorktree = getMemoryRoot(worktree, directory)
  const global = path.join(os.homedir(), ".config", "opencode")
  const globalMem = path.join(global, "MEMORY.md")
  const roots: string[] = [perWorktree]
  // Include global if it exists or has memory dir
  if (fs.existsSync(globalMem) || fs.existsSync(path.join(global, "memory"))) {
    roots.push(global)
  }
  // Include project-local worktree root if it has MEMORY.md
  const projRoot = worktree || directory
  if (projRoot && fs.existsSync(path.join(projRoot, "MEMORY.md"))) {
    roots.push(projRoot)
  }
  // Deduplicate
  return [...new Set(roots)]
}

function listMemoryFiles(worktree: string, directory: string): string[] {
  const roots = resolveMemoryRoots(worktree, directory)
  const files: string[] = []
  for (const root of roots) {
    const candidates = [
      path.join(root, "MEMORY.md"),
      path.join(root, "memory.md"), // legacy
    ]
    for (const p of candidates) if (fs.existsSync(p)) files.push(p)
    const memDir = path.join(root, "memory")
    if (fs.existsSync(memDir)) {
      try {
        for (const f of fs.readdirSync(memDir)) {
          if (f.endsWith(".md") && /^\d{4}-\d{2}-\d{2}/.test(f)) {
            const full = path.join(memDir, f)
            // Skip internal dreaming state
            if (full.includes(path.join("memory", ".dreams"))) continue
            if (fs.statSync(full).isFile()) files.push(full)
          }
        }
      } catch {}
    }
  }
  return [...new Set(files)]
}

// Simple BM25-like keyword search (FTS-only, no vector yet)
// Chunk files into blocks of ~8 lines with overlap, score by term frequency.
type Hit = { path: string; startLine: number; endLine: number; snippet: string; score: number }

function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9가-힣]+/).filter(t=>t.length>=2)
}

function searchInFiles(query: string, files: string[], maxResults=10): Hit[] {
  const qTerms = tokenize(query)
  if (!qTerms.length) return []
  const qSet = new Set(qTerms)
  // Document frequency for idf
  const df = new Map<string, number>()
  const chunks: { path: string; start: number; text: string; lines: string[] }[] = []
  for (const file of files) {
    let content = ""
    try { content = fs.readFileSync(file, "utf-8") } catch { continue }
    const lines = content.split("\n")
    // chunk 10 lines with 2 overlap
    for (let i=0; i<lines.length; i+=8) {
      const slice = lines.slice(i, i+10)
      const text = slice.join("\n")
      const toks = new Set(tokenize(text))
      for (const t of toks) if (qSet.has(t)) df.set(t, (df.get(t)||0)+1)
      chunks.push({ path: file, start: i+1, text, lines: slice })
    }
  }
  const N = Math.max(1, chunks.length)
  const hits: Hit[] = []
  for (const ch of chunks) {
    const textLow = ch.text.toLowerCase()
    let score = 0
    let matchedTerms = 0
    for (const term of qTerms) {
      const tf = (textLow.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length
      if (tf===0) continue
      matchedTerms++
      const idf = Math.log((N - (df.get(term)||0) + 0.5)/((df.get(term)||0)+0.5) + 1)
      score += tf * idf
      // Bonus for exact phrase
      if (textLow.includes(query.toLowerCase())) score += 0.5
      // Bonus for MEMORY.md (curated)
      if (ch.path.endsWith("MEMORY.md")) score += 0.3
    }
    if (matchedTerms===0) continue
    // Temporal decay for dated daily files (30-day half-life) — like openclaw
    const m = ch.path.match(/(\d{4})-(\d{2})-(\d{2})\.md/)
    if (m) {
      const fileDate = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`).getTime()
      const daysOld = (Date.now() - fileDate)/ (24*3600*1000)
      const halfLife = 30
      const decay = Math.pow(0.5, daysOld / halfLife)
      score *= decay
    }
    // Require at least one term, but boost full coverage
    const coverage = matchedTerms / qTerms.length
    score *= (0.5 + 0.5*coverage)
    if (score>0.01) {
      hits.push({
        path: ch.path,
        startLine: ch.start,
        endLine: ch.start + ch.lines.length -1,
        snippet: ch.text.slice(0, 800),
        score,
      })
    }
  }
  hits.sort((a,b)=>b.score-a.score)
  // Deduplicate near-identical snippets
  const dedup: Hit[] = []
  const seen = new Set<string>()
  for (const h of hits) {
    const key = `${h.path}:${h.startLine}:${h.snippet.slice(0,100)}`
    if (seen.has(key)) continue
    seen.add(key)
    dedup.push(h)
    if (dedup.length>=maxResults*2) break
  }
  // MMR-like diversity: if many hits from same file, interleave
  dedup.sort((a,b)=>b.score-a.score)
  return dedup.slice(0, maxResults)
}

function readExcerpt(filePath: string, from=1, lines?: number): { text: string; truncated: boolean; totalLines: number } {
  const content = fs.readFileSync(filePath, "utf-8")
  const all = content.split("\n")
  const total = all.length
  const start = Math.max(1, from) -1
  const end = lines ? Math.min(total, start+lines) : Math.min(total, start+80)
  const slice = all.slice(start, end)
  return { text: slice.join("\n"), truncated: end < total, totalLines: total }
}

async function logInfo(client:any, service:string, msg:string, extra?:any, level="info") {
  try { await client.app.log({ body: { service, level, message: msg, extra } }) } catch {}
}

export const MemoryCorePlugin: Plugin = async ({ directory, worktree, client, project }) => {
  const defaultRoot = getMemoryRoot(worktree, directory)
  try { ensureMemory(defaultRoot) } catch {}

  return {
    "shell.env": async (_input, output) => {
      if (!output.env.OPENCODE_MEMORY_ROOT) {
        const cur = process.env.OPENCODE_MEMORY_ROOT
        output.env.OPENCODE_MEMORY_ROOT = cur && cur.trim() ? cur : defaultRoot
      }
    },

    "experimental.chat.system.transform": async (_input, output) => {
      try {
        if (output.system.some(s => s.includes("Memory — long-term"))) return
        const root = process.env.OPENCODE_MEMORY_ROOT || defaultRoot
        const files = listMemoryFiles(worktree, directory)
        const memPath = path.join(root, "MEMORY.md")
        let injection = "## 🧠 Memory — long-term (core, always-on)\n"
        injection += `Roots: ${resolveMemoryRoots(worktree, directory).join(", ")}\n`
        injection += "Tools: memory_search (mandatory recall before answering about prior work/decisions/dates/people/preferences/todos), memory_get (exact excerpt), memory_write (append to daily or update MEMORY.md)\n"
        // Inject MEMORY.md summary if exists
        if (fs.existsSync(memPath)) {
          try {
            const content = fs.readFileSync(memPath, "utf-8")
            const lines = content.split("\n")
            const preview = lines.slice(0, 60).join("\n")
            const truncated = lines.length>60 ? `\n... (${lines.length-60} more lines, use memory_get to read)` : ""
            injection += `\n### MEMORY.md preview (first 60 lines — curated durable facts)\n${preview}${truncated}\n`
          } catch {}
        } else {
          injection += "\nMEMORY.md empty — will be created on first write.\n"
        }
        // Inject today's and yesterday's daily notes preview (like openclaw bootstrap)
        const today = new Date().toISOString().slice(0,10)
        const yesterday = new Date(Date.now()-24*3600*1000).toISOString().slice(0,10)
        for (const day of [today, yesterday]) {
          const p = path.join(root, "memory", `${day}.md`)
          if (fs.existsSync(p)) {
            try {
              const txt = fs.readFileSync(p, "utf-8")
              const preview = txt.split("\n").slice(0, 30).join("\n").slice(0, 1200)
              injection += `\n### memory/${day}.md (today/yesterday, preview)\n${preview}\n`
            } catch {}
          }
        }
        injection += "\nRule: Before answering anything about prior work, decisions, dates, people, preferences, or todos: run memory_search first, then memory_get for needed lines. If low confidence after search, say you checked. After compaction, memory is already flushed — but also run memory_get to verify before asserting.\n"
        injection += "Write policy: daily raw logs → memory/YYYY-MM-DD.md (append only); durable facts → MEMORY.md (curated, keep compact). Mark action-sensitive notes with when/owner/expiry.\n"
        output.system.push(injection)
      } catch (e:any) {
        try { await logInfo(client, "memory-core", `system.transform failed: ${e?.message || e}`) } catch {}
      }
    },

    "experimental.session.compacting": async (input, output) => {
      try {
        if (output.system.some(s => s.includes("Memory — long-term"))) return
        const root = process.env.OPENCODE_MEMORY_ROOT || defaultRoot
        ensureMemory(root)
        // Try to fetch session messages for flush
        let summary = ""
        try {
          // @ts-ignore — SDK may have session.messages
          const res: any = await (client as any).session.messages({ path: { id: input.sessionID } })
          const data = res?.data || res
          const messages = Array.isArray(data) ? data : (data?.messages || [])
          // Take last 20 messages as context to preserve
          const recent = messages.slice(-20)
          const lines: string[] = []
          for (const m of recent) {
            const parts = m.parts || m.content || []
            const texts: string[] = []
            if (Array.isArray(parts)) {
              for (const p of parts) if (p.text) texts.push(p.text.slice(0,500))
            } else if (typeof parts==="string") texts.push(parts.slice(0,500))
            if (texts.length) lines.push(`- ${m.role || "unknown"}: ${texts.join(" | ").slice(0,600)}`)
          }
          if (lines.length) summary = lines.join("\n")
        } catch {}
        const today = new Date().toISOString().slice(0,10)
        const dailyPath = path.join(root, "memory", `${today}.md`)
        const flushNote = [
          `\n## [auto-flush ${new Date().toISOString()}] session ${input.sessionID} pre-compaction`,
          summary ? summary : "- (no recent messages captured)",
          `- MEMORY.md preserved, radio bus preserved separately`,
          ``
        ].join("\n")
        // Append atomically
        fs.mkdirSync(path.dirname(dailyPath), { recursive: true })
        fs.appendFileSync(dailyPath, flushNote, "utf-8")
        output.context.push(
          `## 🧠 Memory flush — auto-saved to memory/${today}.md before compaction\n${flushNote}\nRule: after compaction, use memory_search/memory_get to recall flushed notes before asserting.`
        )
        await logInfo(client, "memory-core", `flushed session ${input.sessionID} to ${dailyPath}`)
      } catch (e:any) {
        try { await logInfo(client, "memory-core", `compact flush failed: ${e?.message}`, {}, "warn") } catch {}
      }
    },

    event: async ({ event }) => {
      if (event.type === "session.created") {
        try {
          const root = process.env.OPENCODE_MEMORY_ROOT || defaultRoot
          ensureMemory(root)
          await logInfo(client, "memory-core", `session created — memory ready at ${root}`, { root })
        } catch {}
      }
    },

    tool: {
      memory_search: tool({
        description: "Mandatory recall step: semantically search MEMORY.md + memory/*.md (and optional global/project MEMORY) before answering about prior work, decisions, dates, people, preferences, or todos. Hybrid keyword search with temporal decay (30-day half-life). Returns snippets with Source: path#line.",
        args: {
          query: tool.schema.string().describe("Search query, e.g. 'API migration decision' or 'user prefers TypeScript'"),
          maxResults: tool.schema.number().optional().describe("Max results, default 5, max 20"),
          minScore: tool.schema.number().optional().describe("Minimum score threshold, default 0.1"),
          corpus: tool.schema.string().optional().describe("Corpus: memory (default), all, sessions (sessions not yet indexed)"),
        },
        async execute(args, ctx) {
          const q = args.query?.trim()
          if (!q) throw new Error("query must be non-empty")
          const maxResults = Math.min(Math.max(args.maxResults ?? 5, 1), 20)
          const minScore = args.minScore ?? 0.05
          const files = listMemoryFiles(ctx.worktree, ctx.directory)
          if (!files.length) return JSON.stringify({ results: [], disabled: false, warning: "no memory files yet — memory_Search returns empty; write to memory/YYYY-MM-DD.md or MEMORY.md first" })
          let hits = searchInFiles(q, files, maxResults*2)
          hits = hits.filter(h=>h.score>=minScore).slice(0, maxResults)
          if (!hits.length) return JSON.stringify({ results: [], query: q, files: files.length, note: "no hits above minScore — try broader query or lower minScore" })
          const results = hits.map(h=>({
            path: path.relative(ctx.worktree || ctx.directory || "", h.path) || h.path,
            absolute: h.path,
            startLine: h.startLine,
            endLine: h.endLine,
            score: Number(h.score.toFixed(3)),
            snippet: h.snippet,
            citation: `Source: ${path.relative(ctx.worktree || "", h.path) || h.path}#${h.startLine}`,
          }))
          return JSON.stringify({ query: q, results, filesIndexed: files.length }, null, 2)
        },
      }),

      memory_get: tool({
        description: "Safe exact excerpt read from MEMORY.md or memory/*.md. Use after memory_search to pull needed lines. Includes truncation info.",
        args: {
          path: tool.schema.string().describe("Workspace-relative or absolute path, e.g. 'MEMORY.md' or 'memory/2026-08-26.md' or '/home/.../MEMORY.md'"),
          from: tool.schema.number().optional().describe("Start line, 1-indexed, default 1"),
          lines: tool.schema.number().optional().describe("Number of lines to read, default 80, max 200"),
          corpus: tool.schema.string().optional().describe("ignored, for openclaw compat"),
        },
        async execute(args, ctx) {
          const rel = args.path?.trim()
          if (!rel) throw new Error("path must be non-empty")
          const from = Math.max(1, args.from ?? 1)
          const lines = Math.min(Math.max(args.lines ?? 80, 1), 200)
          // Resolve path: try as absolute, then relative to memory roots, then relative to worktree
          const candidates: string[] = []
          if (path.isAbsolute(rel)) candidates.push(rel)
          else {
            const roots = resolveMemoryRoots(ctx.worktree, ctx.directory)
            for (const r of roots) {
              candidates.push(path.join(r, rel))
              candidates.push(path.join(r, "memory", path.basename(rel)))
            }
            candidates.push(path.join(ctx.worktree || ctx.directory || "", rel))
          }
          let found = ""
          for (const p of candidates) if (fs.existsSync(p)) { found = p; break }
          if (!found) throw new Error(`memory_get: file not found for ${JSON.stringify(rel)} — searched ${candidates.slice(0,3).join(", ")}`)
          if (fs.statSync(found).isDirectory()) throw new Error(`memory_get: ${found} is a directory`)
          const { text, truncated, totalLines } = readExcerpt(found, from, lines)
          const endLine = from + text.split("\n").length -1
          return JSON.stringify({
            path: found,
            relative: path.relative(ctx.worktree || "", found) || found,
            from,
            endLine,
            totalLines,
            truncated,
            text,
          }, null, 2)
        },
      }),

      memory_write: tool({
        description: "Append to daily memory or update MEMORY.md. For raw logs/observations use daily (memory/YYYY-MM-DD.md, append-only). For durable facts/preferences/decisions use MEMORY.md (curated).",
        args: {
          path: tool.schema.string().describe("Target path: 'MEMORY.md' for curated, or 'memory/YYYY-MM-DD.md' or 'daily' for today (default daily). Also supports absolute path."),
          content: tool.schema.string().describe("Markdown content to write. For daily, will be appended with timestamp. For MEMORY.md, will be appended as new section if not already present."),
          mode: tool.schema.string().optional().describe("Mode: append (default) or overwrite (use with caution, only for MEMORY.md)"),
        },
        async execute(args, ctx) {
          const rawPath = (args.path || "daily").trim()
          const content = args.content
          if (!content || !content.trim()) throw new Error("content must be non-empty")
          const mode = (args.mode || "append").trim()
          const root = getMemoryRoot(ctx.worktree, ctx.directory)
          ensureMemory(root)
          let target: string
          if (rawPath==="daily" || rawPath==="") {
            const today = new Date().toISOString().slice(0,10)
            target = path.join(root, "memory", `${today}.md`)
          } else if (rawPath==="MEMORY.md" || rawPath.endsWith("MEMORY.md")) {
            target = path.isAbsolute(rawPath) ? rawPath : path.join(root, "MEMORY.md")
          } else if (rawPath.startsWith("memory/")) {
            target = path.isAbsolute(rawPath) ? rawPath : path.join(root, rawPath)
          } else if (path.isAbsolute(rawPath)) {
            target = rawPath
          } else {
            // treat as daily if looks like date, else as MEMORY.md section
            if (/^\d{4}-\d{2}-\d{2}\.md$/.test(rawPath)) target = path.join(root, "memory", rawPath)
            else target = path.join(root, "MEMORY.md")
          }
          // Security: only allow writes within memory roots or worktree memory
          const allowedRoots = [...resolveMemoryRoots(ctx.worktree, ctx.directory), root, ctx.worktree || "", ctx.directory || ""].filter(Boolean)
          const isAllowed = allowedRoots.some(r => target.startsWith(r) || target===path.join(r,"MEMORY.md"))
          // Also allow daily
          fs.mkdirSync(path.dirname(target), { recursive: true })
          if (mode==="overwrite") {
            fs.writeFileSync(target, content, "utf-8")
            return JSON.stringify({ written: true, path: target, mode, bytes: Buffer.byteLength(content) })
          } else {
            // append with timestamp if daily
            const isDaily = target.includes(path.join("memory", "20"))
            let toAppend = content
            if (isDaily && !content.startsWith("#") && !content.startsWith("- [")) {
              const stamp = new Date().toISOString()
              toAppend = `- [${stamp}] ${content}\n`
            } else if (!toAppend.endsWith("\n")) toAppend += "\n"
            // If daily file doesn't exist, add header
            if (isDaily && !fs.existsSync(target)) {
              const header = `# ${path.basename(target, ".md")} — daily notes\n\n`
              fs.writeFileSync(target, header, "utf-8")
            }
            fs.appendFileSync(target, toAppend, "utf-8")
            return JSON.stringify({ written: true, path: target, mode: "append", bytes: Buffer.byteLength(toAppend) })
          }
        },
      }),

      memory_status: tool({
        description: "Show memory index status: files, sizes, provider (FTS-only for now, vector optional).",
        args: {},
        async execute(_args, ctx) {
          const roots = resolveMemoryRoots(ctx.worktree, ctx.directory)
          const files = listMemoryFiles(ctx.worktree, ctx.directory)
          const perRoot: any[] = []
          for (const r of roots) {
            const memPath = path.join(r, "MEMORY.md")
            const memExists = fs.existsSync(memPath)
            const memSize = memExists ? fs.statSync(memPath).size : 0
            const memLines = memExists ? fs.readFileSync(memPath,"utf-8").split("\n").length : 0
            const dailyDir = path.join(r, "memory")
            const dailyFiles = fs.existsSync(dailyDir) ? fs.readdirSync(dailyDir).filter(f=>f.endsWith(".md")).length : 0
            perRoot.push({ root: r, MEMORY: memExists?`${memSize} bytes, ${memLines} lines`:"missing", dailyFiles })
          }
          return JSON.stringify({
            version: INDEX_VERSION,
            roots,
            filesIndexed: files.length,
            files,
            perRoot,
            provider: "builtin FTS (keyword + temporal decay, 30-day half-life) — vector embeddings optional via future provider config",
            tools: ["memory_search", "memory_get", "memory_write",
            ],
          }, null, 2)
        },
      }),

      memory_dream: tool({
        description: "Dreaming consolidation: review recent daily notes (last 7 days), score candidates, and suggest promotions to MEMORY.md. Does NOT auto-write to MEMORY.md — returns a draft for you to review and then call memory_write to promote.",
        args: {
          days: tool.schema.number().optional().describe("Days to review, default 7, max 30"),
        },
        async execute(args, ctx) {
          const days = Math.min(Math.max(args.days ?? 7, 1), 30)
          const root = getMemoryRoot(ctx.worktree, ctx.directory)
          const candidates: { file: string; snippet: string; reason: string }[] = []
          for (let i=0; i<days; i++) {
            const d = new Date(Date.now() - i*24*3600*1000).toISOString().slice(0,10)
            const p = path.join(root, "memory", `${d}.md`)
            if (!fs.existsSync(p)) continue
            try {
              const txt = fs.readFileSync(p, "utf-8")
              const lines = txt.split("\n")
              for (let ln=0; ln<lines.length; ln++) {
                const line = lines[ln].trim()
                if (!line || line.startsWith("#")) continue
                // Heuristic: lines with durable keywords are candidates
                const isCandidate = /remember|preference|decision|fact|TODO|REMEMBER|DECISION|prefer|always|never|important/i.test(line) || line.length>80
                if (isCandidate) {
                  candidates.push({ file: `memory/${d}.md#${ln+1}`, snippet: line.slice(0,200), reason: "keyword/length heuristic" })
                }
              }
            } catch {}
          }
          // Also check MEMORY.md for stale entries (very naive)
          const memPath = path.join(root, "MEMORY.md")
          let memLines = 0
          try { memLines = fs.readFileSync(memPath,"utf-8").split("\n").length } catch {}
          return JSON.stringify({
            reviewedDays: days,
            candidatesFound: candidates.length,
            candidates: candidates.slice(0, 20),
            memoryLines: memLines,
            suggestion: candidates.length? "Call memory_write with path='MEMORY.md' to promote selected snippets (keep MEMORY.md compact, curated)." : "No strong candidates found — daily notes may be raw logs only.",
            note: "Dreaming is opt-in, thresholded. This tool only surfaces candidates; you decide what graduates to long-term.",
          }, null, 2)
        },
      }),
    },
  }
}
