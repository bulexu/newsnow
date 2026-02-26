import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"

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

function makeGarminSourceDetail(_path: string) {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    const container = $(".container.newsroom").first()
    if (!container.length) return undefined

    const title = container.find("h1").first().text().trim()
    const body = container.clone()
    body.find("h1,.news_otherbtn,.news_pageview,script,style").remove()
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
    return title ? `## ${title}\n\n${markdown}` : markdown
  }
}

const bulletin = makeGarminSource("/news/bulletin/")
const news = makeGarminSource("/news/garmin/")
const bulletinDetail = makeGarminSourceDetail("/news/bulletin/")
const newsDetail = makeGarminSourceDetail("/news/garmin/")

export const details = defineSourceDetail({
  "garmin-bulletin": bulletinDetail,
  "garmin-news": newsDetail,
})

export default defineSource({
  "garmin-bulletin": bulletin,
  "garmin-news": news,
})
