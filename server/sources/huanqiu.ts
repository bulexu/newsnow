import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"

interface Item {
  aid: string
  title: string
  summary: string
  ctime: string
  host: string
}

interface Res {
  list: Item[]
}

function makeHuanqiuSource(apiUrl: string) {
  return defineSource(async () => {
    const res: Res = await myFetch(apiUrl, { parseResponse: JSON.parse })
    return (res.list ?? [])
      .filter(k => k.aid && k.title)
      .map(k => ({
        id: k.aid,
        title: k.title,
        url: `https://${k.host}/article/${k.aid}`,
        pubDate: Number(k.ctime),
        extra: k.summary ? { hover: k.summary } : undefined,
      }))
  })
}

function makeHuanqiuSourceDetail() {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    let bodyHtml = ""
    const textareaContent = $("textarea.article-content").first().text().trim()
    if (textareaContent) {
      const $detail = load(textareaContent)
      const body = $detail("article section[data-type='rtext']").first().length
        ? $detail("article section[data-type='rtext']").first()
        : $detail("article").first()
      if (!body.length) return undefined
      body.find("script,style,adv-loader").remove()
      body.find("[href]").each((_, el) => {
        const href = $detail(el).attr("href")
        if (href) $detail(el).attr("href", toAbsoluteUrl(href, item.url))
      })
      body.find("img[src]").each((_, el) => {
        const src = $detail(el).attr("src")
        if (src) $detail(el).attr("src", toAbsoluteUrl(src, item.url))
      })
      bodyHtml = body.html() || ""
    } else {
      const content = $("div.content").first()
      if (!content.length) return undefined
      const body = content.find("article section[data-type='rtext']").first().length
        ? content.find("article section[data-type='rtext']").first()
        : content.find("article").first()
      if (!body.length) return undefined
      body.find("script,style,adv-loader").remove()
      body.find("[href]").each((_, el) => {
        const href = $(el).attr("href")
        if (href) $(el).attr("href", toAbsoluteUrl(href, item.url))
      })
      body.find("img[src]").each((_, el) => {
        const src = $(el).attr("src")
        if (src) $(el).attr("src", toAbsoluteUrl(src, item.url))
      })
      bodyHtml = body.html() || ""
    }

    const markdown = html2md(bodyHtml)
      .replace(/\n{3,}/g, "\n\n")
      .trim()

    if (!markdown) return undefined
    return item.title ? `## ${item.title}\n\n${markdown}` : markdown
  }
}

const finance = makeHuanqiuSource("https://finance.huanqiu.com/api/list?node=%22/e3pmh1hmp/e3pmh28kq%22,%22/e3pmh1hmp/e3pn61chp%22,%22/e3pmh1hmp/e3ptkencb%22,%22/e3pmh1hmp/e3pn47c56%22,%22/e3pmh1hmp/e3pn61an9%22,%22/e3pmh1hmp/e7i6qafud%22,%22/e3pmh1hmp/e3pn47igg%22,%22/e3pmh1hmp/e3pmh1iab%22,%22/e3pmh1hmp/e3pn61831%22,%22/e3pmh1hmp/e3pn62ihu%22,%22/e3pmh1hmp/e3pmh2bsv%22,%22/e3pmh1hmp/e3pmh2bsv/e3pn603rc%22,%22/e3pmh1hmp/e3pn61fkq%22,%22/e3pmh1hmp/fu13fv4i5%22&offset=0&limit=24")
const tech = makeHuanqiuSource("https://tech.huanqiu.com/api/list?node=%22/e3pmh164r/e3pmh33i9%22,%22/e3pmh164r/e3pmtm015%22,%22/e3pmh164r/e3pn60k1f%22,%22/e3pmh164r/e3pmh3dh4%22,%22/e3pmh164r/e3pn46ot6%22,%22/e3pmh164r/e3pmtmdvg%22,%22/e3pmh164r/e3pmh2hq8%22,%22/e3pmh164r/e3pn4sfhb%22,%22/e3pmh164r/e3pmtod3t%22,%22/e3pmh164r/e3pn4gh77%22,%22/e3pmh164r/e3pmtlao3%22&offset=0&limit=24")
const capital = makeHuanqiuSource("https://capital.huanqiu.com/api/list?node=%22/e5d59phvs/e5d5m10mv%22,%22/e5d59phvs/e63j24g2m%22,%22/e5d59phvs/evq0lg1h3%22,%22/e5d59phvs/evq0lkmga%22,%22/e5d59phvs/evq1mo2qf%22,%22/e5d59phvs/evq1mo2qf/evq1msmdn%22,%22/e5d59phvs/evq1mv740%22,%22/e5d59phvs/f29f7sbm1%22&offset=0&limit=24")

const financeDetail = makeHuanqiuSourceDetail()
const techDetail = makeHuanqiuSourceDetail()
const capitalDetail = makeHuanqiuSourceDetail()

export const details = defineSourceDetail({
  "huanqiu": financeDetail,
  "huanqiu-news": financeDetail,
  "huanqiu-tech": techDetail,
  "huanqiu-capital": capitalDetail,
})

export default defineSource({
  "huanqiu": finance,
  "huanqiu-news": finance,
  "huanqiu-tech": tech,
  "huanqiu-capital": capital,
})
