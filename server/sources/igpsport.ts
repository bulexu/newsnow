import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"

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

function makeIgpsportSourceDetail(_path: string) {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    const body = $("div.prose.max-w-full.mt-8").first().length
      ? $("div.prose.max-w-full.mt-8").first()
      : $(".prose").first()

    if (!body.length) return undefined

    body.find("script,style").remove()
    body.find("[href]").each((_, el) => {
      const href = $(el).attr("href")
      if (href) $(el).attr("href", toAbsoluteUrl(href, BASE_URL))
    })
    body.find("img[src]").each((_, el) => {
      const src = $(el).attr("src")
      if (src) $(el).attr("src", toAbsoluteUrl(src, BASE_URL))
    })

    const markdown = html2md(body.html() || "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()

    if (!markdown) return undefined
    return item.title ? `## ${item.title}\n\n${markdown}` : markdown
  }
}

const news = makeIgpsportSource("/blog")
const newsDetail = makeIgpsportSourceDetail("/blog")

export const details = defineSourceDetail({
  "igpsport-news": newsDetail,
})

export default defineSource({
  "igpsport-news": news,
})
