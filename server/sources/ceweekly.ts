import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"

const BASE_URL = "https://www.ceweekly.cn"

function makeCeweeklySource(path: string) {
  return defineSource(async () => {
    const html: string = await myFetch(`${BASE_URL}${path}`)
    const $ = load(html)
    const items: NewsItem[] = []

    $(".image_text_box_child").each((_, el) => {
      const $el = $(el)
      const $a = $el.find(".child_right_top a")
      const href = $a.attr("href") ?? ""
      const title = $a.text().trim()
      if (!href || !title) return
      const dateText = $el.find(".child_right_bottom .left span:nth-child(2)").text().trim()
      const url = href.startsWith("http") ? href : `${BASE_URL}${href}`
      const id = href.replace(/\/$/, "").split("/").pop()?.replace(".html", "") ?? url
      items.push({
        id,
        title,
        url,
        pubDate: dateText ? new Date(dateText).getTime() : undefined,
      })
    })

    return items
  })
}

function makeCeweeklySourceDetail(_path: string) {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    const body = $(".page_content").first()
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

const newsImportant = makeCeweeklySource("/news/important/")
const macro = makeCeweeklySource("/finance/macro/")
const newsImportantDetail = makeCeweeklySourceDetail("/news/important/")
const macroDetail = makeCeweeklySourceDetail("/finance/macro/")

export const details = defineSourceDetail({
  "ceweekly": newsImportantDetail,
  "ceweekly-news_important": newsImportantDetail,
  "ceweekly-macro": macroDetail,
})

export default defineSource({
  "ceweekly": newsImportant,
  "ceweekly-news_important": newsImportant,
  "ceweekly-macro": macro,
})
