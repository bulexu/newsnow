import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"

const BASE_URL = "https://road.cc"

function makeRoadccSource(path: string) {
  return defineSource(async () => {
    const html: string = await myFetch(`${BASE_URL}${path}`)
    const $ = load(html)
    const news: NewsItem[] = []

    $(".e-loop-item").each((_, el) => {
      const $el = $(el)
      const $link = $el.find("a.loop-grid-listing[href]").first()
      const href = $link.attr("href") || ""
      const url = href.startsWith("http") ? href : `${BASE_URL}${href}`

      const title = $el.find(".elementor-widget-theme-post-title h2").first().text().trim()
      if (!href || !title) return

      const desc = $el.find(".elementor-widget-heading .elementor-heading-title").first().text().trim()
      const dateText = $el.find(".full__date").first().text().trim()
      const commentText = $el.find(".comment-msg-before").first().text().trim()

      const classList = $el.attr("class") || ""
      const idMatch = classList.match(/e-loop-item-(\d+)/)
      const id = idMatch ? idMatch[1] : url

      news.push({
        id,
        title,
        url,
        pubDate: dateText ? new Date(dateText).getTime() : undefined,
        extra: {
          hover: desc || undefined,
          info: commentText && commentText !== "o" ? `${commentText} 评论` : undefined,
        },
      })
    })

    return news
  })
}

function makeRoadccSourceDetail() {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    const body = $(".elementor-widget-theme-post-content").first()
    if (!body.length) return undefined

    body.find("script,style").remove()
    body.find("[href]").each((_, el) => {
      const href = $(el).attr("href")
      if (href) $(el).attr("href", toAbsoluteUrl(href, BASE_URL, item.url))
    })
    body.find("img[src]").each((_, el) => {
      const src = $(el).attr("src")
      if (src) $(el).attr("src", toAbsoluteUrl(src, BASE_URL, item.url))
    })

    const markdown = html2md(body.html() || "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()

    if (!markdown) return undefined
    return item.title ? `## ${item.title}\n\n${markdown}` : markdown
  }
}

const news = makeRoadccSource("/news")
const newsDetail = makeRoadccSourceDetail()

export const details = defineSourceDetail({
  "roadcc-news": newsDetail,
})

export default defineSource({
  "roadcc-news": news,
})
