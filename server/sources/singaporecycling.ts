import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { normalizeText } from "#/utils/banner"

const PAGE_URL = "https://singaporecycling.org.sg/pages/event-policies-guidelines"

const policies = defineSource(async () => {
  const html: string = await myFetch(PAGE_URL)
  const $ = load(html)
  const items: NewsItem[] = []

  $("main .rte a[href]").each((_, element) => {
    const link = $(element)
    const href = link.attr("href")?.trim()
    const title = normalizeText(link.text())
    if (!href || !title || href.startsWith("mailto:")) return
    const url = new URL(href, PAGE_URL).toString()
    const version = new URL(url).searchParams.get("v")
    const pubDate = version && /^\d{10}$/.test(version) ? Number(version) * 1000 : undefined

    items.push({
      id: url,
      title,
      url,
      pubDate,
      extra: {
        info: url.split("?")[0].split(".").pop()?.toUpperCase() || "Document",
      },
    })
  })

  return items
})

// Shopify 博客 /blogs/news: div.card__information > h2/h3.card__heading + 日期文本 "February 12, 2024"
const news = defineSource(async () => {
  const html: string = await myFetch("https://singaporecycling.org.sg/blogs/news")
  const $ = load(html)
  const items: NewsItem[] = []
  const seen = new Set<string>()

  $("div.card__information h2.card__heading a[href], div.card__information h3.card__heading a[href]").each((_, element) => {
    const link = $(element)
    const href = link.attr("href")?.trim()
    if (!href || !href.includes("/blogs/news/")) return
    const url = new URL(href, "https://singaporecycling.org.sg").toString()
    if (seen.has(url)) return
    seen.add(url)
    const title = normalizeText(link.text())
    if (!title) return

    const dateText = normalizeText(link.closest(".card__information").find("time, [class*='date']").first().text())
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
  "singaporecycling-policies": policies,
  "singaporecycling-news": news,
})
