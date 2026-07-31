import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"

const BASE_URL = "http://www.cyclingchina.net"

function makeCyclingchinaSource(path: string) {
  return defineSource(async () => {
    const html: string = await myFetch(`${BASE_URL}${path}`)
    const $ = load(html)
    const news: NewsItem[] = []
    const seen = new Set<string>()

    // 对应 XPath: //div[@class='main']/div[@class='col-left']//div[contains(@style, 'line-height')]
    $("div.main > div.col-left div").each((_, el) => {
      const $el = $(el)
      if (!($el.attr("style") || "").includes("line-height")) return

      // 卡片 <a href="..."> 中包含图片、标题、描述
      const $a = $el.find("a[href]").first()
      const href = $a.attr("href") || ""
      if (!href) return
      if (seen.has(href)) return
      seen.add(href)

      const title = $a.attr("title") || $el.find("h4").first().text().trim()
      if (!title) return

      const desc = $el.find(".news2_con").first().text().trim()
      const idMatch = href.match(/\/(\d+)\.html$/)
      const id = idMatch ? idMatch[1] : href

      news.push({
        id,
        title,
        url: href,
        // 列表页 DOM 没有日期; pubDate 由 detail getter 从详情页 XPath 写入
        extra: desc ? { hover: desc } : undefined,
      })
    })

    return news
  })
}

function makeCyclingchinaSourceDetail() {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    // 对应 XPath: //div[@id='Article']/h1/span[2] 取发布时间, 直接写入 item.pubDate
    const timeText = $("#Article h1 span").eq(1).text().trim()
    const ts = timeText ? new Date(`${timeText.replace(/-/g, "/")}:00+08:00`).getTime() : Number.NaN
    if (Number.isFinite(ts)) {
      item.pubDate = ts
    }

    // 对应 XPath: //div[@id='Article']/div[@class='content']
    const body = $("#Article div.content").first()
    if (!body.length) return undefined

    body.find("script,style,#pages,.text-c").remove()
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

const news = makeCyclingchinaSource("/site/html/news/")
const events = makeCyclingchinaSource("/site/html/events/")
const newProduct = makeCyclingchinaSource("/site/html/new_product/")
const mustKnow = makeCyclingchinaSource("/site/html/must_know/")

const newsDetail = makeCyclingchinaSourceDetail()
const eventsDetail = makeCyclingchinaSourceDetail()
const newProductDetail = makeCyclingchinaSourceDetail()
const mustKnowDetail = makeCyclingchinaSourceDetail()

export const details = defineSourceDetail({
  "cyclingchina-news": newsDetail,
  "cyclingchina-events": eventsDetail,
  "cyclingchina-new-product": newProductDetail,
  "cyclingchina-must-know": mustKnowDetail,
})

export default defineSource({
  "cyclingchina-news": news,
  "cyclingchina-events": events,
  "cyclingchina-new-product": newProduct,
  "cyclingchina-must-know": mustKnow,
})
