import { Buffer } from "node:buffer"
import { load } from "cheerio"
import iconv from "iconv-lite"
import type { NewsItem } from "@shared/types"

const BASE_URL = "http://www.biketo.com"

function makeBiketoSource(path: string) {
  return defineSource(async () => {
    const response: ArrayBuffer = await myFetch(`${BASE_URL}${path}`, {
      responseType: "arrayBuffer",
    })
    const $ = load(iconv.decode(Buffer.from(response), "gb2312"))
    const news: NewsItem[] = []

    $("li.col-article-item").each((_, el) => {
      const $el = $(el)
      const href = $el.find("a").first().attr("href") ?? ""
      const title = $el.find(".title").text().trim()
      const dateText = $el.find(".time").text().trim()
      const desc = $el.find(".desc").text().trim()
      if (!href || !title) return
      const url = href.startsWith("http") ? href : `${BASE_URL}${href}`
      const id = url.match(/\/(\d+)\.html$/)?.[1] ?? url
      news.push({
        id,
        title,
        url,
        pubDate: dateText ? new Date(dateText).getTime() : undefined,
        extra: desc ? { hover: desc } : undefined,
      })
    })

    return news
  })
}

const hotnews = makeBiketoSource("/hotnews/")
const activities = makeBiketoSource("/activities/")
const cyclexpress = makeBiketoSource("/cyclexpress/")
const road = makeBiketoSource("/road/")
const ebike = makeBiketoSource("/e-bike/")
const racingnews = makeBiketoSource("/racingnews/")
const business = makeBiketoSource("/business/")
const enterprise = makeBiketoSource("/enterprise/")
const shop = makeBiketoSource("/shop/")

export default defineSource({
  "biketo": hotnews,
  "biketo-hotnews": hotnews,
  "biketo-activities": activities,
  "biketo-cyclexpress": cyclexpress,
  "biketo-road": road,
  "biketo-e-bike": ebike,
  "biketo-racingnews": racingnews,
  "biketo-business": business,
  "biketo-enterprise": enterprise,
  "biketo-shop": shop,
})
