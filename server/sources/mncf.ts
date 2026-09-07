import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { normalizeText } from "#/utils/banner"

const BASE_URL = "https://www.mncf.my"
// Joomla featured 视图, 列表项无日期, 标题即 readmore 链接文本
const FEATURED_URL = `${BASE_URL}/index.php?Itemid=483&option=com_content&view=featured`

// 马来西亚自行车联合会 Malaysian National Cycling Federation (MNCF)
export default defineSource(async () => {
  const html: string = await myFetch(FEATURED_URL)
  const $ = load(html)
  const news: NewsItem[] = []

  $(".blog-featured .item").each((_, element) => {
    const item = $(element)
    const link = item.find("p.readmore a[href]").first()
    const href = link.attr("href") || ""
    const title = normalizeText(link.text()).replace(/^Read more:\s*/i, "")
    if (!href || !title) return

    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`
    news.push({
      id: url,
      title,
      url,
    })
  })

  return news
})
