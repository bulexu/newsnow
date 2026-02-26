import { load } from "cheerio"
import type { NewsItem } from "@shared/types"

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

const newsImportant = makeCeweeklySource("/news/important/")
const macro = makeCeweeklySource("/finance/macro/")

export default defineSource({
  "ceweekly": newsImportant,
  "ceweekly-news_important": newsImportant,
  "ceweekly-macro": macro,
})
