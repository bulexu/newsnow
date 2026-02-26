import { load } from "cheerio"
import type { NewsItem } from "@shared/types"

const BASE_URL = "https://www.garmin.com.cn"

function makeGarminSource(path: string) {
  return defineSource(async () => {
    const html: string = await myFetch(`${BASE_URL}${path}`)
    const $ = load(html)
    const news: NewsItem[] = []

    $("article.post-card").each((_, el) => {
      const $el = $(el)
      const href = $el.find("a").first().attr("href") ?? ""
      const title = $el.find(".post-card__title").text().trim()
      if (!href || !title) return
      const dateText = $el.find(".post-card__date").text().trim().replace(/\./g, "-")
      const url = href.startsWith("http") ? href : `${BASE_URL}${href}`
      const id = href.replace(/\/$/, "").split("/").pop() ?? url
      news.push({
        id,
        title,
        url,
        pubDate: dateText ? new Date(dateText).getTime() : undefined,
      })
    })

    return news
  })
}

const bulletin = makeGarminSource("/news/bulletin/")
const news = makeGarminSource("/news/garmin/")

export default defineSource({
  "garmin-bulletin": bulletin,
  "garmin-news": news,
})
