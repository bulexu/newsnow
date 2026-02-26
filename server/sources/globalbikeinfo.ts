import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"

interface Res {
  status: number
  message: string
  data: {
    id: string
    title: string
    newsurl: string
    smalltext: string
    newstime: string
    writer: string
    onclick: string
    plnum: string
    column_name: string
    channel_id: string
  }[]
}

const BASE_URL = "https://www.globalbikeinfo.com"

function makeGlobalBikeInfoSource(channelId: number, page = 1) {
  return defineSource(async () => {
    const res: Res = await myFetch(
      `${BASE_URL}/api/v1/news/list?m=info&a=getNewsList&type=channel&id=${channelId}&page=${page}`,
    )
    return res.data.map(k => ({
      id: k.id,
      title: k.title,
      url: `${BASE_URL}${k.newsurl}`,
      pubDate: new Date(k.newstime).getTime(),
      extra: {
        hover: k.smalltext,
        info: `${k.column_name} · ${k.onclick} 阅读`,
      },
    }))
  })
}

function makeGlobalBikeInfoSourceDetail(_channelId: number) {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    const body = $("#container").first()
    if (!body.length) return undefined
    const content = body.closest(".content")
    const title = content.find(".title").first().text().trim()

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
    return title ? `## ${title}\n\n${markdown}` : markdown
  }
}

const news = makeGlobalBikeInfoSource(2)
const newsDetail = makeGlobalBikeInfoSourceDetail(2)

export const details = defineSourceDetail({
  "globalbikeinfo-news": newsDetail,
})

export default defineSource({
  "globalbikeinfo-news": news,
})
