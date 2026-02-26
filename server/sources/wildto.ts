import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"

interface Res {
  result: number
  data: {
    wNewsId: number
    wTitle: string
    wContentUrl: string
    wDescriptian: string
    wSourceCreatedTime: string
    wWatch: number
    wSubCategory: string
  }[]
}

const BASE_URL = "https://www.wildto.com"

function makeWildtoSource(apiPath: string, pageSize = 10) {
  return defineSource(async () => {
    const res: Res = await myFetch(`${BASE_URL}/api/${apiPath}`, {
      method: "POST",
      body: { page_size: pageSize },
    })
    return res.data.map(k => ({
      id: String(k.wNewsId),
      title: k.wTitle,
      url: `${BASE_URL}/news/${k.wNewsId}.html`,
      pubDate: new Date(k.wSourceCreatedTime).getTime(),
      extra: {
        hover: k.wDescriptian,
        info: `${k.wSubCategory} · ${k.wWatch} 阅读`,
      },
    }))
  })
}

function makeWildtoSourceDetail(_path: string) {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    const playerView = $(".playerView").first()
    if (!playerView.length) return undefined

    const title = playerView.find("h3").first().text().trim()
    const body = playerView.clone()
    body.find("h3,.titles,script,style").remove()
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
    return title ? `## ${title}\n\n${markdown}` : markdown
  }
}

const news = makeWildtoSource("cycling/0")
const product = makeWildtoSource("product/0")
const industryBusiness = makeWildtoSource("industry/business")
const industryExhibition = makeWildtoSource("industry/exhibition")
const bikeHotnews = makeWildtoSource("bike/hotnews")

const newsDetail = makeWildtoSourceDetail("cycling/0")
const productDetail = makeWildtoSourceDetail("product/0")
const industryBusinessDetail = makeWildtoSourceDetail("industry/business")
const industryExhibitionDetail = makeWildtoSourceDetail("industry/exhibition")
const bikeHotnewsDetail = makeWildtoSourceDetail("bike/hotnews")

export const details = defineSourceDetail({
  "wildto-news": newsDetail,
  "wildto-product": productDetail,
  "wildto-industry-business": industryBusinessDetail,
  "wildto-industry-exhibition": industryExhibitionDetail,
  "wildto-bike-hotnews": bikeHotnewsDetail,
})

export default defineSource({
  "wildto-news": news,
  "wildto-product": product,
  "wildto-industry-business": industryBusiness,
  "wildto-industry-exhibition": industryExhibition,
  "wildto-bike-hotnews": bikeHotnews,
})
