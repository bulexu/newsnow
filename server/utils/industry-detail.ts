import { load } from "cheerio"
import { unzipSync } from "fflate"
import { extractText, getDocumentProxy } from "unpdf"
import type { NewsItem } from "@shared/types"
import { html2md } from "./html2md"

const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024
const ARTICLE_SELECTORS = [
  "#content-side .entry-content",
  "article .entry-content",
  "article .post-content",
  "article .article-content",
  "article .article-body",
  "article .content-body",
  "article [itemprop='articleBody']",
  "[itemprop='articleBody']",
  ".article__content",
  ".article-content",
  ".article-body",
  ".post-content",
  ".entry-content",
  ".news-detail",
  ".doc__text",
  ".image-with-text__content",
  "main article",
  "article",
]

function cleanMarkup(html: string, url: string) {
  const $ = load(html)
  $("script,style,nav,aside,footer,form,iframe,button,.share,.social,.related,.advertisement,.breadcrumb").remove()
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href")
    if (href) $(element).attr("href", new URL(href, url).toString())
  })
  $("img[src]").each((_, element) => {
    const src = $(element).attr("src")
    if (src) $(element).attr("src", new URL(src, url).toString())
  })
  return html2md($("body").html() || "").replace(/\n{3,}/g, "\n\n").trim()
}

export function contentFromHtmlFragment(html: string | undefined, url: string) {
  return html ? cleanMarkup(html, url) || undefined : undefined
}

export function articleContentFromHtml(html: string, url: string) {
  const $ = load(html)
  const selectors = new URL(url).hostname.endsWith("pzkol.pl")
    ? [".article", ...ARTICLE_SELECTORS]
    : ARTICLE_SELECTORS
  for (const selector of selectors) {
    const body = $(selector).first()
    if (body.length && body.text().trim().length >= 80) {
      const markdown = cleanMarkup(body.html() || "", url)
      if (markdown.length >= 80) return markdown
    }
  }

  for (const element of $("script[type='application/ld+json']").toArray()) {
    try {
      const data = JSON.parse($(element).html() || "")
      const candidates = Array.isArray(data) ? data : [data, ...(data?.["@graph"] || [])]
      const articleBody = candidates.find(value => typeof value?.articleBody === "string")?.articleBody
      if (articleBody) return articleBody.trim()
    } catch {}
  }
  return undefined
}

function xmlParagraphs(xml: string) {
  const $ = load(xml, { xmlMode: true })
  return $("w\\:p").toArray().map(element => $(element).find("w\\:t").toArray().map(text => $(text).text()).join("")).filter(Boolean).join("\n\n")
}

function extractOfficeText(bytes: Uint8Array, extension: string) {
  const files = unzipSync(bytes)
  const decoder = new TextDecoder()
  if (extension === "docx") {
    const document = files["word/document.xml"]
    return document ? xmlParagraphs(decoder.decode(document)) : undefined
  }
  if (extension === "xlsx") {
    const strings = files["xl/sharedStrings.xml"]
    const values = strings
      ? load(decoder.decode(strings), { xmlMode: true })("si").toArray().map(element => load(element, { xmlMode: true }).text())
      : []
    return Object.entries(files)
      .filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
      .map(([name, contents]) => {
        const $ = load(decoder.decode(contents), { xmlMode: true })
        const rows = $("row").toArray().map(row => $(row).find("c").toArray().map((cell) => {
          const value = $(cell).find("v").first().text()
          return $(cell).attr("t") === "s" ? values[Number(value)] || "" : value
        }).join("\t"))
        return `## ${name}\n\n${rows.join("\n")}`
      })
      .join("\n\n")
  }
  return undefined
}

async function documentContent(url: string, extension: string) {
  const response = await myFetch.raw<ArrayBuffer>(url, { responseType: "arrayBuffer", timeout: 20000, retry: 1 })
  const bytes = new Uint8Array(response._data)
  if (!bytes.length || bytes.length > MAX_DOCUMENT_BYTES) return undefined
  if (extension === "pdf") {
    const pdf = await getDocumentProxy(bytes)
    const result = await extractText(pdf, { mergePages: true })
    return typeof result.text === "string" ? result.text.trim() : undefined
  }
  if (extension === "docx" || extension === "xlsx") return extractOfficeText(bytes, extension)?.trim()
  return undefined
}

interface PrismicBlock {
  type?: string
  text?: string
  spans?: Array<{
    start: number
    end: number
    type?: string
    data?: { url?: string }
  }>
}

function prismicText(block: PrismicBlock) {
  let text = block.text || ""
  const links = (block.spans || [])
    .filter(span => span.type === "hyperlink" && span.data?.url)
    .sort((a, b) => b.start - a.start)
  for (const span of links) {
    if (span.start < 0 || span.end > (block.text?.length || 0) || span.start >= span.end) continue
    const rawUrl = span.data!.url!
    const url = /^[\w.+-]+@[\w.-]+\.[a-z]+$/i.test(rawUrl) ? `mailto:${rawUrl}` : rawUrl
    if (!/^https?:\/\//i.test(url) && !url.startsWith("mailto:")) continue
    const label = text.slice(span.start, span.end).replaceAll("[", "\\[").replaceAll("]", "\\]")
    text = `${text.slice(0, span.start)}[${label}](${url.replace(/[()]/g, "\\$&")})${text.slice(span.end)}`
  }
  return text.trim()
}

function prismicContent(blocks: PrismicBlock[] | undefined) {
  return blocks?.map((block) => {
    const text = prismicText(block)
    if (!text) return ""
    if (block.type?.startsWith("heading")) {
      const level = Number(block.type.slice(7))
      return `${"#".repeat(Number.isFinite(level) ? Math.max(1, Math.min(level, 6)) : 2)} ${text}`
    }
    if (block.type === "list-item") return `- ${text}`
    if (block.type === "o-list-item") return `1. ${text}`
    return text
  }).filter(Boolean).join("\n\n")
}

async function peopleForBikesContent(html: string) {
  const raw = load(html)("#__NEXT_DATA__").text()
  if (!raw) return undefined
  const page = JSON.parse(raw)?.props?.pageProps?.page
  const news = prismicContent(page?.news?.main_content)
  if (news) return news
  const report = page?.report
  if (report?.pdf?.url) return documentContent(report.pdf.url, "pdf")
  return prismicContent(report?.body)
}

export async function industryDetail(item: NewsItem) {
  const url = new URL(item.url)
  if (!/^https?:$/.test(url.protocol)) return undefined
  const extension = url.pathname.match(/\.(pdf|docx|xlsx|doc|xls)$/i)?.[1]?.toLowerCase()
    || (typeof item.extra?.info === "string" && item.extra.info.toLowerCase() === "pdf" ? "pdf" : undefined)
  if (extension) return documentContent(url.toString(), extension)

  const html: string = await myFetch(url.toString(), { timeout: 15000, retry: 1 })
  if (url.hostname.endsWith("peopleforbikes.org")) {
    const content = await peopleForBikesContent(html)
    if (content) return content
  }
  return articleContentFromHtml(html, url.toString())
}
