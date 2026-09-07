import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { normalizeText } from "#/utils/banner"

const BASE_URL = "https://www.bike-eu.com"

function makeBikeEuropeSource(path: string) {
  const pageUrl = `${BASE_URL}${path}`
  return defineSource(async () => {
    const html: string = await myFetch(pageUrl)
    const $ = load(html)
    const items: NewsItem[] = []
    const seen = new Set<string>()

    $(".collection.component .groups a[href]").each((_, element) => {
      const link = $(element)
      const href = link.attr("href")?.trim()
      if (!href || !/^\/\d+\//.test(href)) return
      const url = new URL(href, BASE_URL).toString()
      if (seen.has(url)) return
      seen.add(url)
      const title = normalizeText(link.text())
      if (!title) return
      const group = normalizeText(link.closest(".group").find("h2,h3,h4").first().text())

      items.push({
        id: href.match(/^\/(\d+)\//)?.[1] || url,
        title,
        url,
        extra: { info: group || undefined },
      })
    })

    return items
  })
}

// 新闻列表: vakmedianet SSR 的 /paginated 页, li.border > a.summary(h3 标题 + time[datetime])
const NEWS_URL = "https://www.bike-eu.com/paginated?title=News&query=(vmnPublisher%20eq%20%27bike-eu%27)%20and%20not(vmnExcludeFrom%2Fany(x%3A%20x%20eq%20%27overview%27))%20and%20(vmnCategory%20ne%20%27%E4%B8%AD%E6%96%87%E9%83%A8%E4%BB%BD%27)"

const news = defineSource(async () => {
  const html: string = await myFetch(NEWS_URL)
  const $ = load(html)
  const items: NewsItem[] = []
  const seen = new Set<string>()

  $("li.border a.summary[href]").each((_, element) => {
    const link = $(element)
    const href = link.attr("href")?.trim()
    if (!href || !/^\/\d+\//.test(href)) return
    const url = new URL(href, BASE_URL).toString()
    if (seen.has(url)) return
    seen.add(url)
    const title = normalizeText(link.find("h2,h3").first().text())
    if (!title) return
    const datetime = link.find("time[datetime]").attr("datetime")

    items.push({
      id: href.match(/^\/(\d+)\//)?.[1] || url,
      title,
      url,
      pubDate: datetime ? new Date(datetime).getTime() : undefined,
    })
  })

  return items
})

export default defineSource({
  "bikeeu-product": makeBikeEuropeSource("/collecties/product"),
  "bikeeu-trade": makeBikeEuropeSource("/collecties/trade"),
  "bikeeu-news": news,
})
