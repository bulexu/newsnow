import type { SourceResponse } from "@shared/types"

export function jsonToRSS(response: SourceResponse): string {
  const { id, items, updatedTime } = response
  const date = new Date(updatedTime).toUTCString()

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${id} News</title>
    <link>https://newsnow.com/${id}</link>
    <description>Latest news from ${id}</description>
    <lastBuildDate>${date}</lastBuildDate>
    <pubDate>${date}</pubDate>
    ${items.map(item => `
    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.url)}</link>
      ${buildRSSDescription(item.extra?.info || "", item.content)}
      ${item.content ? `<content:encoded><![CDATA[${toCdata(item.content)}]]></content:encoded>` : ""}
      ${buildRSSEnclosure(item.content)}
      <pubDate>${new Date(item.pubDate || updatedTime).toUTCString()}</pubDate>
      <guid isPermaLink="false">${escapeXml(item.id.toString())}</guid>
    </item>
    `).join("")}
  </channel>
</rss>`
}

export function jsonToAtom(response: SourceResponse): string {
  const { id, items, updatedTime } = response
  const date = new Date(updatedTime).toISOString()

  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${id} News</title>
  <link href="https://newsnow.com/${id}"/>
  <updated>${date}</updated>
  <id>https://newsnow.com/feed/${id}</id>
  <author><name>${id}</name></author>
  ${items.map(item => `
  <entry>
    <title>${escapeXml(item.title)}</title>
    <link href="${escapeXml(item.url)}"/>
    <summary>${escapeXml(item.extra?.info || "")}</summary>
    ${item.content ? `<content type="html"><![CDATA[${toCdata(item.content)}]]></content>` : ""}
    <updated>${new Date(item.pubDate || updatedTime).toISOString()}</updated>
    <id>${escapeXml(item.url || `urn:newsnow:${id}:${item.id}`)}</id>
  </entry>
  `).join("")}
</feed>`
}

function toCdata(value: string): string {
  return value.replace(/\]\]>/g, "]]]]><![CDATA[>")
}

function extractFirstImageUrl(content?: string): string | undefined {
  if (!content) return undefined
  const matched = content.match(/<img[^>]*src=["']([^"']+)["']/i)
  return matched?.[1]
}

function buildRSSDescription(summary: string, content?: string): string {
  if (content) {
    return `<description><![CDATA[${toCdata(content)}]]></description>`
  }
  return `<description>${escapeXml(summary)}</description>`
}

function buildRSSEnclosure(content?: string): string {
  const imageUrl = extractFirstImageUrl(content)
  if (!imageUrl) return ""
  return `<enclosure url="${escapeXml(imageUrl)}" type="${guessImageMimeType(imageUrl)}" />`
}

function guessImageMimeType(imageUrl: string): string {
  try {
    const path = new URL(imageUrl).pathname.toLowerCase()
    if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg"
    if (path.endsWith(".png")) return "image/png"
    if (path.endsWith(".webp")) return "image/webp"
    if (path.endsWith(".gif")) return "image/gif"
    if (path.endsWith(".avif")) return "image/avif"
    if (path.endsWith(".svg")) return "image/svg+xml"
  } catch {
    // Fallback for invalid URLs or unexpected formats.
  }
  return "image/jpeg"
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;"
      case ">": return "&gt;"
      case "&": return "&amp;"
      case "'": return "&apos;"
      case "\"": return "&quot;"
      default: return c
    }
  })
}
