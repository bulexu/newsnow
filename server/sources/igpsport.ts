import { load } from "cheerio"
import type { NewsItem } from "@shared/types"

const BASE_URL = "https://www.igpsport.cn"

function makeIgpsportSource(path: string) {
  return defineSource(async () => {
    const html: string = await myFetch(`${BASE_URL}${path}`)
    const $ = load(html)
    const items: NewsItem[] = []

    $("a[href^=\"/blog/\"]").each((_, el) => {
      const $el = $(el)
      const href = $el.attr("href") ?? ""
      const title = $el.find(".line-clamp-2").text().trim()
      if (!href || !title) return
      const desc = $el.find(".hidden").text().trim()
      const dateText = $el.find(".text-base").text().trim()
      const url = `${BASE_URL}${href}`
      const id = href.replace(/^\/blog\//, "")
      items.push({
        id,
        title,
        url,
        pubDate: dateText ? new Date(dateText).getTime() : undefined,
        extra: desc ? { hover: desc } : undefined,
      })
    })

    return items
  })
}

const news = makeIgpsportSource("/blog")

export default defineSource({
  "igpsport-news": news,
})
