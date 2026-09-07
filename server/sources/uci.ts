import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { normalizeText } from "#/utils/banner"

const PAGE_URL = "https://www.uci.org/regulations/3MyLDDrwJCJJ0BGGOFzOat"

interface Regulation {
  title?: string
  version?: string
  inForceFrom?: string
  link?: { url?: string }
}

function parseDate(value?: string) {
  const match = value?.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
  if (!match) return undefined
  return new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00Z`).getTime()
}

const regulations = defineSource(async () => {
  const html: string = await myFetch(PAGE_URL)
  const $ = load(html)
  const rootProps = $("[data-component='ContentWithSidebarBlock']").attr("data-props")
  if (!rootProps) return []
  const content = JSON.parse(rootProps)?.content
  if (!content) return []

  const inner = load(content)
  const items: NewsItem[] = []
  const seen = new Set<string>()

  inner("[data-component='RegulationsDownload']").each((_, element) => {
    const raw = inner(element).attr("data-props")
    if (!raw) return
    const section = JSON.parse(raw)
    const documents: Regulation[] = [
      ...(section.rulesInForce || []),
      ...(section.upcomingAmendments || []),
    ]

    documents.forEach((document) => {
      if (!document.title || !document.link?.url) return
      const url = new URL(document.link.url, PAGE_URL).toString()
      if (seen.has(url)) return
      seen.add(url)
      const pubDate = parseDate(document.version)

      items.push({
        id: url,
        title: document.title,
        url,
        pubDate,
        extra: {
          info: [section.heading, document.version].filter(Boolean).join(" · "),
        },
      })
    })
  })

  return items.sort((a, b) => Number(b.pubDate || 0) - Number(a.pubDate || 0))
})

// 新闻: 页面列表为客户端渲染, SSR 的 NewsListingsModule data-props 仅含头条;
// 完整列表走 sitemap.xml (/news/ + /pressrelease/ 条目), 标题由 slug 转换, 日期取 lastmod
const ACRONYMS = new Set(["uci", "mtb", "bmx", "xco", "xcc", "xcm", "wt", "cyc"])
const SMALL_WORDS = new Set(["and", "of", "the", "for", "to", "in", "on", "at", "with", "a", "an", "de", "di"])

function titleFromSlug(slug: string) {
  return slug.split("-").filter(Boolean).map((word, index) => {
    if (ACRONYMS.has(word)) return word.toUpperCase()
    if (index > 0 && SMALL_WORDS.has(word)) return word
    return word.charAt(0).toUpperCase() + word.slice(1)
  }).join(" ")
}

const news = defineSource(async () => {
  const pageHtml: string = await myFetch(PAGE_URL.replace(/\/regulations\/.*/, "/news/all-news/6IQ886FTfWV8yd13Egt9v3?page=1"))
  const $page = load(pageHtml)
  const items: NewsItem[] = []
  const seen = new Set<string>()

  // 头条文章带完整标题和精确时间
  const rawProps = $page("[data-component='NewsListingsModule']").attr("data-props")
  if (rawProps) {
    try {
      const featured = JSON.parse(rawProps)?.newsList?.featuredArticle
      if (featured?.title && featured?.url) {
        const url = new URL(featured.url, "https://www.uci.org").toString()
        seen.add(url)
        items.push({
          id: featured.id || url,
          title: normalizeText(featured.title),
          url,
          pubDate: featured.date ? new Date(featured.date).getTime() : undefined,
          extra: { info: featured.category?.title || undefined },
        })
      }
    } catch {}
  }

  const sitemapXml: string = await myFetch("https://www.uci.org/sitemap.xml")
  const matches = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>\s*(?:<lastmod>([^<]+)<\/lastmod>)?/g)]
  for (const match of matches) {
    const url = match[1]
    const lastmod = match[2]
    if (!/uci\.org\/(?:news|pressrelease)\//.test(url)) continue
    if (seen.has(url)) continue
    seen.add(url)
    const slug = url.split("/").filter(Boolean).slice(-2, -1)[0]
    if (!slug) continue
    items.push({
      id: url,
      title: titleFromSlug(decodeURIComponent(slug)),
      url,
      pubDate: lastmod ? new Date(`${lastmod}T00:00:00Z`).getTime() : undefined,
    })
  }

  return items
    .filter(item => item.title)
    .sort((a, b) => Number(b.pubDate || 0) - Number(a.pubDate || 0))
    .slice(0, 30)
})

export default defineSource({
  "uci-regulations": regulations,
  "uci-news": news,
})
