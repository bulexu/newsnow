import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { normalizeText } from "#/utils/banner"

const BASE_URL = "https://www.pzkol.pl"
const NEWS_URL = `${BASE_URL}/aktualnosci/`

function parseImageDate(src?: string) {
  // 列表页无日期, 缩略图文件名含上传时间: 20260906_121522.jpeg
  const m = src?.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.(?:jpe?g|png|webp)/)
  if (!m) return undefined
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6]))
  return Number.isFinite(date.getTime()) ? date.getTime() : undefined
}

// 波兰自行车协会 Polski Związek Kolarski (PZKol)
export default defineSource(async () => {
  const html: string = await myFetch(NEWS_URL)
  const $ = load(html)
  const news: NewsItem[] = []

  $("a[href*='/aktualnosci/']").each((_, element) => {
    const a = $(element)
    const title = normalizeText(a.find("h3").first().text())
    if (!title) return
    const href = a.attr("href") || ""
    if (!href) return

    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`
    news.push({
      id: url,
      title,
      url,
      pubDate: parseImageDate(a.find("img[src]").first().attr("src")),
      extra: {
        hover: normalizeText(a.find("div p").first().text()) || undefined,
      },
    })
  })

  return news
})
