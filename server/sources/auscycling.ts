import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { normalizeText } from "#/utils/banner"

function makeAusCyclingSource(url: string) {
  return defineSource(async () => {
    const html: string = await myFetch(url)
    const $ = load(html)
    const items: NewsItem[] = []
    const seen = new Set<string>()

    $("a[href*='admin.platform.auscycling.org.au/uploads/']").each((_, element) => {
      const link = $(element)
      const href = link.attr("href")?.trim()
      if (!href) return
      const absoluteUrl = new URL(href, url).toString()
      if (seen.has(absoluteUrl)) return
      seen.add(absoluteUrl)
      const title = normalizeText(link.text())
        .replace(/^Download\s+/i, "")
        .replace(/, opens in a new tab$/i, "")
      if (!title) return

      items.push({
        id: absoluteUrl,
        title,
        url: absoluteUrl,
        extra: {
          info: absoluteUrl.split("?")[0].split(".").pop()?.toUpperCase() || "Document",
        },
      })
    })

    return items
  })
}

// 新闻页: ul.grid 卡片, h3 标题 + 日期 span "Sep 4, 2026"
const news = defineSource(async () => {
  const html: string = await myFetch("https://auscycling.org.au/news")
  const $ = load(html)
  const items: NewsItem[] = []
  const seen = new Set<string>()

  $("ul.grid li a[href*='/news/']").each((_, element) => {
    const link = $(element)
    const href = link.attr("href")?.trim()
    if (!href) return
    const url = new URL(href, "https://auscycling.org.au").toString()
    if (seen.has(url)) return
    seen.add(url)
    const title = normalizeText(link.find("h3").first().text())
    if (!title) return

    const dateText = normalizeText(link.find("p.text-sm span").last().text())
    const pubDate = new Date(dateText).getTime()

    items.push({
      id: url,
      title,
      url,
      pubDate: Number.isFinite(pubDate) ? pubDate : undefined,
    })
  })

  return items
})

export default defineSource({
  "auscycling-policies": makeAusCyclingSource("https://auscycling.org.au/about/policies"),
  "auscycling-annualreport": makeAusCyclingSource("https://auscycling.org.au/about/annual-report"),
  "auscycling-governance": makeAusCyclingSource("https://auscycling.org.au/about/governance"),
  "auscycling-strategy": makeAusCyclingSource("https://auscycling.org.au/about/strategy"),
  "auscycling-news": news,
})
