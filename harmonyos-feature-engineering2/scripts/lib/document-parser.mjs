const BLOCK_TAGS = "address|article|aside|blockquote|div|dl|dt|dd|figcaption|figure|footer|header|hr|main|nav|ol|p|section|table|tbody|td|tfoot|th|thead|tr|ul"

export function decodeEntities(value) {
  return String(value)
    .replace(/&#x([0-9a-f]+);/gi, (match, hex) => safeCodePoint(match, Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (match, dec) => safeCodePoint(match, Number.parseInt(dec, 10)))
    .replace(/&nbsp;|&ensp;|&emsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
}

function safeCodePoint(fallback, value) {
  try {
    return String.fromCodePoint(value)
  } catch {
    return fallback
  }
}

function stripFragment(value) {
  return decodeEntities(String(value).replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""))
    .replace(/[ \t\f\v]+/g, " ")
    .trim()
}

function normalizeUrl(href, baseUrl) {
  try {
    const parsed = baseUrl ? new URL(href, baseUrl) : new URL(href)
    if (!["http:", "https:"].includes(parsed.protocol)) return null
    return parsed.toString()
  } catch {
    return null
  }
}

function isOfficialUrl(value) {
  try {
    const host = new URL(value).hostname.toLowerCase()
    return host === "developer.huawei.com" || host.endsWith(".developer.huawei.com")
  } catch {
    return false
  }
}

function fenceFor(content) {
  const runs = String(content).match(/`+/g) ?? []
  const longest = runs.reduce((max, run) => Math.max(max, run.length), 0)
  return "`".repeat(Math.max(3, longest + 1))
}

function normalizeMarkdown(value) {
  const lines = String(value).replace(/\r\n?/g, "\n").split("\n")
  const output = []
  let fence = null
  let blank = false
  for (const raw of lines) {
    const line = fence ? raw.replace(/[ \t]+$/g, "") : raw.replace(/[ \t]+/g, " ").trim()
    const fenceMatch = /^(`{3,})([^`]*)$/.exec(line.trim())
    if (fenceMatch) fence = fence ? null : fenceMatch[1]
    if (!fence && !line) {
      if (!blank && output.length) output.push("")
      blank = true
      continue
    }
    output.push(line)
    blank = false
  }
  while (output[output.length - 1] === "") output.pop()
  return output.join("\n")
}

function collectMarkdownLinks(markdown) {
  const links = []
  const seen = new Set()
  for (const match of String(markdown).matchAll(/\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g)) {
    const url = match[2]
    if (seen.has(url)) continue
    seen.add(url)
    links.push({ url, text: match[1].trim(), official: isOfficialUrl(url) })
  }
  return links
}

function collectCodeBlocks(markdown) {
  const blocks = []
  const lines = String(markdown).split("\n")
  let current = null
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (!current) {
      const start = /^\s*(`{3,})(.*)$/.exec(line)
      if (start) current = { fence: start[1], language: start[2].trim() || null, startLine: index + 1, lines: [] }
      continue
    }
    if (line.trimStart().startsWith(current.fence)) {
      blocks.push({
        index: blocks.length,
        language: current.language,
        startLine: current.startLine,
        endLine: index + 1,
        content: current.lines.join("\n"),
      })
      current = null
    } else {
      current.lines.push(line)
    }
  }
  return blocks
}

function collectSections(markdown) {
  const lines = String(markdown).split("\n")
  const sections = []
  let current = { level: 0, heading: "文档开头", lineStart: 1, lines: [] }
  for (let index = 0; index < lines.length; index += 1) {
    const heading = /^(#{1,6})\s+(.+)$/.exec(lines[index])
    if (heading) {
      if (current.lines.some((line) => line.trim()) || sections.length) {
        current.lineEnd = index
        current.text = current.lines.join("\n").trim()
        delete current.lines
        sections.push(current)
      }
      current = { level: heading[1].length, heading: heading[2].trim(), lineStart: index + 1, lines: [] }
    } else {
      current.lines.push(lines[index])
    }
  }
  current.lineEnd = lines.length
  current.text = current.lines.join("\n").trim()
  delete current.lines
  if (current.text || current.heading !== "文档开头" || sections.length === 0) sections.push(current)
  return sections.map((section, index) => ({ id: `section-${index + 1}`, ...section }))
}

function toPlainText(markdown) {
  let inFence = false
  let fence = null
  const result = []
  for (const raw of String(markdown).split("\n")) {
    const marker = /^(`{3,})/.exec(raw)
    if (marker) {
      if (!inFence) {
        inFence = true
        fence = marker[1]
      } else if (raw.startsWith(fence)) {
        inFence = false
        fence = null
      }
      continue
    }
    const line = inFence
      ? raw
      : raw
          .replace(/^#{1,6}\s+/, "")
          .replace(/^[-*+]\s+/, "")
          .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
          .replace(/`([^`]*)`/g, "$1")
          .replace(/[*~]/g, "")
    if (line.trim()) result.push(line.trim())
  }
  return result.join("\n")
}

export function parseMarkdown(markdown, options = {}) {
  const contentMarkdown = normalizeMarkdown(markdown)
  const heading = /^#\s+(.+)$/m.exec(contentMarkdown)
  return {
    title: options.title ?? (heading ? heading[1].trim() : null),
    contentMarkdown,
    contentText: toPlainText(contentMarkdown),
    sections: collectSections(contentMarkdown),
    codeBlocks: collectCodeBlocks(contentMarkdown),
    links: collectMarkdownLinks(contentMarkdown),
  }
}

export function parseHtml(html, options = {}) {
  const links = []
  const seenLinks = new Set()
  const codeBlocks = []
  const rawTitle = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(String(html))
  let value = String(html)
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript|svg|template|iframe|head)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(?:script|style|noscript|svg|template|iframe)\b[^>]*\/>/gi, "")

  value = value.replace(/<pre\b([^>]*)>([\s\S]*?)<\/pre>/gi, (_, attrs, body) => {
    const language = /(?:language-|lang-)([A-Za-z0-9_+-]+)/i.exec(`${attrs} ${body}`)?.[1] ?? null
    const content = decodeEntities(String(body).replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "")).replace(/^\n+|\n+$/g, "")
    const fence = fenceFor(content)
    const placeholder = `DOCREVIEWCODEBLOCK${codeBlocks.length}TOKEN`
    codeBlocks.push({ index: codeBlocks.length, language, content, placeholder, fence })
    return `\n${placeholder}\n`
  })

  value = value.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_, attrs, body) => {
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1]
    const label = stripFragment(body)
    if (!href) return label
    const url = normalizeUrl(decodeEntities(href), options.baseUrl)
    if (!url) return label
    if (!seenLinks.has(url)) {
      seenLinks.add(url)
      links.push({ url, text: label, official: isOfficialUrl(url) })
    }
    return label ? `[${label}](${url})` : url
  })

  value = value.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, body) => `\n${"#".repeat(Number(level))} ${stripFragment(body)}\n`)
  value = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/?(?:th|td)\b[^>]*>/gi, " | ")
    .replace(new RegExp(`<\/?(?:${BLOCK_TAGS})\\b[^>]*>`, "gi"), "\n")
    .replace(/<[^>]+>/g, "")
  value = decodeEntities(value)

  for (const block of codeBlocks) {
    value = value.replace(block.placeholder, `${block.fence}${block.language ?? ""}\n${block.content}\n${block.fence}`)
  }
  const parsed = parseMarkdown(value, { title: options.title ?? (rawTitle ? stripFragment(rawTitle[1]) : null) })
  const combinedLinks = [...links]
  const known = new Set(links.map((item) => item.url))
  for (const item of parsed.links) {
    if (!known.has(item.url)) combinedLinks.push(item)
  }
  return { ...parsed, links: combinedLinks }
}
