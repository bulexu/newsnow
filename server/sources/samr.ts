import { load } from "cheerio"
import type { NewsItem } from "@shared/types"

const BASE_URL = "https://www.samr.gov.cn"
const API_BASE = `${BASE_URL}/api-gateway/jpaas-publish-server/front/page/build/unit?parseType=bulidstatic&webId=29e9522dc89d4e088a953d8cede72f4c&tplSetId=5c30fb89ae5e48b9aefe3cdf49853830&pageType=column&tagId=%E5%86%85%E5%AE%B9%E5%8C%BA%E5%9F%9F&editType=null&pageId=`

interface Res {
  data: { html: string }
}

function makeSamrSource(pageId: string) {
  return defineSource(async () => {
    const res: Res = await myFetch(`${API_BASE}${pageId}`, { parseResponse: JSON.parse })
    const $ = load(res.data.html)
    const items: NewsItem[] = []

    $(".Three_zhnlist_02 ul").each((_, el) => {
      const $el = $(el)
      const $a = $el.find("li.nav04Left02_content a")
      const href = $a.attr("href") ?? ""
      const title = $a.attr("title") ?? $a.text().trim()
      if (!href || !title) return
      const dateText = $el.find("li.nav04Left02_contenttime").text().trim()
      const url = href.startsWith("http") ? href : `${BASE_URL}${href}`
      const id = href.replace(/\/$/, "").split("/").pop() ?? url
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

const xwfbt = makeSamrSource("5fb1ceb699444ed2a679754ec3cc020d")
const szyw = makeSamrSource("04bc1e78c503470cb1b95e69752e009f")

export default defineSource({
  "samr-xwfbt": xwfbt,
  "samr-szyw": szyw,
})
