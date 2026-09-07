import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { normalizeText } from "#/utils/banner"

const PAGE_URL = "https://jbpi.or.jp/business-list/"

const business = defineSource(async () => {
  const html: string = await myFetch(PAGE_URL)
  const $ = load(html)
  const items: NewsItem[] = []

  $(".business-archive-lists-list.info-item").each((_, element) => {
    const row = $(element)
    const href = row.find("a[href]").first().attr("href")?.trim()
    const title = normalizeText(row.find(".info-item-text").first().text())
    if (!href || !title) return
    const date = normalizeText(row.find("time").first().text()).match(/(\d{4})年(\d{1,2})月/)
    const category = normalizeText(row.find(".label--round").first().text())
    const pubDate = date
      ? new Date(`${date[1]}-${date[2].padStart(2, "0")}-01T00:00:00+09:00`).getTime()
      : undefined
    const url = new URL(href, PAGE_URL).toString()

    items.push({
      id: url,
      title,
      url,
      pubDate,
      extra: { info: category || "PDF" },
    })
  })

  return items
})

export default defineSource({
  "jbpi-business": business,
})
