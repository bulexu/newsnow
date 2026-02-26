import { Buffer } from "node:buffer"
import { load } from "cheerio"
import iconv from "iconv-lite"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"

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

function makeBiketoSourceDetail(_path: string) {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const response: ArrayBuffer = await myFetch(item.url, {
      responseType: "arrayBuffer",
    })
    const $ = load(iconv.decode(Buffer.from(response), "gb2312"))
    const articleMain = $(".co-content .article-main").first()
    if (!articleMain.length) return undefined

    articleMain.find("script,style,.co-article-nav,.pagination").remove()
    articleMain.find("[href]").each((_, el) => {
      const href = $(el).attr("href")
      if (href) $(el).attr("href", toAbsoluteUrl(href, BASE_URL))
    })
    articleMain.find("img[src]").each((_, el) => {
      const src = $(el).attr("src")
      if (src) $(el).attr("src", toAbsoluteUrl(src, BASE_URL))
    })

    const markdown = html2md(articleMain.html() || "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()

    return markdown || undefined
  }
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

const hotnewsDetail = makeBiketoSourceDetail("/hotnews/")
const activitiesDetail = makeBiketoSourceDetail("/activities/")
const cyclexpressDetail = makeBiketoSourceDetail("/cyclexpress/")
const roadDetail = makeBiketoSourceDetail("/road/")
const ebikeDetail = makeBiketoSourceDetail("/e-bike/")
const racingnewsDetail = makeBiketoSourceDetail("/racingnews/")
const businessDetail = makeBiketoSourceDetail("/business/")
const enterpriseDetail = makeBiketoSourceDetail("/enterprise/")
const shopDetail = makeBiketoSourceDetail("/shop/")

export const details = defineSourceDetail({
  "biketo-hotnews": hotnewsDetail,
  "biketo-activities": activitiesDetail,
  "biketo-cyclexpress": cyclexpressDetail,
  "biketo-road": roadDetail,
  "biketo-e-bike": ebikeDetail,
  "biketo-racingnews": racingnewsDetail,
  "biketo-business": businessDetail,
  "biketo-enterprise": enterpriseDetail,
  "biketo-shop": shopDetail,
})

export default defineSource({
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
