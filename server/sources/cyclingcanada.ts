import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { normalizeText } from "#/utils/banner"

const PAGE_URL = "https://cyclingcanada.ca/get-involved/officials/rules-policies/"

const rules = defineSource(async () => {
  const html: string = await myFetch(PAGE_URL)
  const $ = load(html)
  const items: NewsItem[] = []
  const seen = new Set<string>()

  $("main .wp-block-group.alignwide a[href]").each((_, element) => {
    const link = $(element)
    const href = link.attr("href")?.trim()
    const title = normalizeText(link.text())
    if (!href || !title) return
    const url = new URL(href, PAGE_URL).toString()
    if (seen.has(url)) return
    seen.add(url)
    const uploadDate = url.match(/\/uploads\/(\d{4})\/(\d{2})\//)
    const pubDate = uploadDate
      ? new Date(`${uploadDate[1]}-${uploadDate[2]}-01T00:00:00-04:00`).getTime()
      : undefined

    items.push({
      id: url,
      title,
      url,
      pubDate,
      extra: {
        info: /\.pdf(?:\?|$)/i.test(url) ? "PDF" : "Link",
      },
    })
  })

  return items
})

// /sport/general/ 新闻: h2 标题链接 + 分组内日期文本 "28/07/2026"(DD/MM/YYYY)
const general = defineSource(async () => {
  const html: string = await myFetch("https://cyclingcanada.ca/sport/general/")
  const $ = load(html)
  const items: NewsItem[] = []
  const seen = new Set<string>()

  $("h2 a[href*='/news/']").each((_, element) => {
    const link = $(element)
    const href = link.attr("href")?.trim()
    if (!href) return
    const url = new URL(href, "https://cyclingcanada.ca").toString()
    if (seen.has(url)) return
    seen.add(url)
    const title = normalizeText(link.text())
    if (!title) return

    const groupText = normalizeText(link.closest(".wp-block-group").text())
    const match = groupText.match(/(\d{2})\/(\d{2})\/(\d{4})/)
    const pubDate = match ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])).getTime() : undefined

    items.push({
      id: url,
      title,
      url,
      pubDate: pubDate && Number.isFinite(pubDate) ? pubDate : undefined,
    })
  })

  return items
})

export default defineSource({
  "cyclingcanada-rules": rules,
  "cyclingcanada-general": general,
})
