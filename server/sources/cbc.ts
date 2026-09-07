import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { normalizeText } from "#/utils/banner"

const BASE_URL = "https://www.cbc.esp.br"
const NEWS_URL = `${BASE_URL}/noticias/index/modalidade/Geral`

// 巴西自行车联合会 Confederação Brasileira de Ciclismo (CBC)
// 列表链接文本自带日期前缀: "06/07/2026 Título da notícia"
export default defineSource(async () => {
  const html: string = await myFetch(NEWS_URL)
  const $ = load(html)
  const news: NewsItem[] = []
  const seen = new Set<string>()

  $("a.conteudo[href]").each((_, element) => {
    const a = $(element)
    const href = a.attr("href") || ""
    const match = normalizeText(a.text()).match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\S.*)$/)
    if (!href || !match) return

    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`
    if (seen.has(url)) return
    seen.add(url)

    const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]))
    news.push({
      id: url,
      title: match[4],
      url,
      pubDate: Number.isFinite(date.getTime()) ? date.getTime() : undefined,
    })
  })

  return news
})
