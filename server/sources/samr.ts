import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"
import { normalizeText } from "#/utils/banner"

const BASE_URL = "https://www.samr.gov.cn"
const API_BASE = `${BASE_URL}/api-gateway/jpaas-publish-server/front/page/build/unit?parseType=bulidstatic&webId=29e9522dc89d4e088a953d8cede72f4c&tplSetId=5c30fb89ae5e48b9aefe3cdf49853830&pageType=column&tagId=%E5%86%85%E5%AE%B9%E5%8C%BA%E5%9F%9F&editType=null&pageId=`

interface Res {
  data: { html: string }
}

interface Attachment {
  name: string
  url: string
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

function makeSamrSourceDetail() {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    // 总局文件类 (通知/公示公告) 结构: div.Three_xilan_02 内含正文 Three_xilan_07 与附件区;
    // 新闻类 (新闻发布/时政要闻) 结构: #zoom。两者择一
    const fileWrap = $("div.Three_xilan_02").first()
    const zoom = $("#zoom").first()
    const body = fileWrap.find("div.Three_xilan_07").first().length
      ? fileWrap.find("div.Three_xilan_07").first()
      : (fileWrap.length ? fileWrap : zoom)
    if (!body.length) return undefined

    // 附件: 对应 XPath ...//ul[@class='contentLeft0102box']//a[contains(@href, '/cms_files/filemanager')]
    // 按 URL 去重; href 为域根绝对路径且自带 ?fileName= 参数
    const attachments: Attachment[] = []
    const seenUrl = new Set<string>()
    const attachScope = fileWrap.length ? fileWrap : body
    attachScope.find("ul.contentLeft0102box a[href*='/cms_files/filemanager']").each((_, el) => {
      const $a = $(el)
      const href = $a.attr("href") || ""
      if (!href) return
      const abs = toAbsoluteUrl(href, BASE_URL, item.url)
      if (seenUrl.has(abs)) return
      seenUrl.add(abs)
      const name = normalizeText($a.text() || $a.attr("title"))
      attachments.push({
        name: name || abs.split("/").pop() || abs,
        url: abs,
      })
    })

    body.find("script,style").remove()
    // 附件段落不在正文容器内时无需移除; 在正文内则移除, 附件单独列出
    body.find("ul.contentLeft0102box a[href*='/cms_files/filemanager']").remove()
    body.find("a").each((_, el) => {
      const href = $(el).attr("href")
      const hasText = $(el).text().trim().length > 0
      const hasImage = $(el).find("img").length > 0
      if (!href && !hasText && !hasImage) {
        $(el).remove()
        return
      }
      if (href) $(el).attr("href", toAbsoluteUrl(href, BASE_URL, item.url))
    })
    body.find("img[src]").each((_, el) => {
      const src = $(el).attr("src")
      if (src) $(el).attr("src", toAbsoluteUrl(src, BASE_URL, item.url))
    })

    let markdown = html2md(body.html() || "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()

    if (!markdown) return undefined

    if (attachments.length) {
      const attachMd = attachments
        .map(att => `- [${att.name}](${att.url})`)
        .join("\n")
      markdown += `\n\n**附件：**\n${attachMd}`
    }

    return item.title ? `## ${item.title}\n\n${markdown}` : markdown
  }
}

const xwfbt = makeSamrSource("5fb1ceb699444ed2a679754ec3cc020d")
const szyw = makeSamrSource("04bc1e78c503470cb1b95e69752e009f")
const tz = makeSamrSource("9c28ab08904c498ca9b6e1b86e96b5f4")
const gsgg = makeSamrSource("dedefc44460a4338ac649d95f0ed8023")

const xwfbtDetail = makeSamrSourceDetail()
const szywDetail = makeSamrSourceDetail()
const tzDetail = makeSamrSourceDetail()
const gsggDetail = makeSamrSourceDetail()

export const details = defineSourceDetail({
  "samr-xwfbt": xwfbtDetail,
  "samr-szyw": szywDetail,
  "samr-tz": tzDetail,
  "samr-gsgg": gsggDetail,
})

export default defineSource({
  "samr-xwfbt": xwfbt,
  "samr-szyw": szyw,
  "samr-tz": tz,
  "samr-gsgg": gsgg,
})
