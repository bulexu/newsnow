import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { html2md, toAbsoluteUrl } from "#/utils/html2md"

const BASE_URL = "http://www.mof.gov.cn"

function parseItems($: ReturnType<typeof load>, selector: string, path: string): NewsItem[] {
  const items: NewsItem[] = []
  $(selector).each((_, el) => {
    const $el = $(el)
    const $a = $el.find("a")
    const href = $a.attr("href") ?? ""
    const title = ($a.attr("title") ?? $a.text()).trim()
    if (!href || !title) return
    const dateText = $el.find("span").text().trim()
    let url: string
    if (href.startsWith("http")) {
      url = href
    } else if (href.startsWith("./")) {
      url = `${BASE_URL}${path}${href.slice(1)}`
    } else {
      url = `${BASE_URL}${href}`
    }
    const id = href.replace(/\/$/, "").split("/").pop()?.replace(".htm", "") ?? url
    items.push({
      id,
      title,
      url,
      pubDate: dateText ? new Date(dateText).getTime() : undefined,
    })
  })
  return items
}

// 财政新闻页面结构
function makeMofNewsSource(path: string) {
  return defineSource(async () => {
    const html: string = await myFetch(`${BASE_URL}${path}`)
    return parseItems(load(html), ".xwfb_listerji .xwfb_listbox li", path)
  })
}

// 财经时点子页面结构
function makeMofCjsdSource(path: string) {
  return defineSource(async () => {
    const html: string = await myFetch(`${BASE_URL}${path}`)
    return parseItems(load(html), ".xwbd_lianbolistfrcon li", path)
  })
}

function makeMofSourceDetail(_path: string) {
  return async (item: NewsItem) => {
    if (!item?.url) return undefined
    const html: string = await myFetch(item.url)
    const $ = load(html)

    const container = $(".box_content").first()
    if (!container.length) return undefined

    const article = container.find(".my_conboxzw .TRS_Editor").first().length
      ? container.find(".my_conboxzw .TRS_Editor").first()
      : container.find(".my_conboxzw").first()

    if (!article.length) return undefined

    article.find("script,style,.gu-download").remove()
    article.find("[href]").each((_, el) => {
      const href = $(el).attr("href")
      if (href) $(el).attr("href", toAbsoluteUrl(href, BASE_URL))
    })
    article.find("img[src]").each((_, el) => {
      const src = $(el).attr("src")
      if (src) $(el).attr("src", toAbsoluteUrl(src, BASE_URL))
    })

    const markdown = html2md(article.html() || "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()

    return markdown || undefined
  }
}

const czxw = makeMofNewsSource("/zhengwuxinxi/caizhengxinwen/")
const zyzfmhwz = makeMofCjsdSource("/zhengwuxinxi/caijingshidian/zyzfmhwz/")
const renminwang = makeMofCjsdSource("/zhengwuxinxi/caijingshidian/renminwang/")
const xinhuanet = makeMofCjsdSource("/zhengwuxinxi/caijingshidian/xinhuanet/")
const jjrb = makeMofCjsdSource("/zhengwuxinxi/caijingshidian/jjrb/")
const jjckb = makeMofCjsdSource("/zhengwuxinxi/caijingshidian/jjckb/")
const zgcjb = makeMofCjsdSource("/zhengwuxinxi/caijingshidian/zgcjb/")
const cjzylm = makeMofCjsdSource("/zhengwuxinxi/caijingshidian/cjzylm/")

const czxwDetail = makeMofSourceDetail("/zhengwuxinxi/caizhengxinwen/")
const zyzfmhwzDetail = makeMofSourceDetail("/zhengwuxinxi/caijingshidian/zyzfmhwz/")
const renminwangDetail = makeMofSourceDetail("/zhengwuxinxi/caijingshidian/renminwang/")
const xinhuanetDetail = makeMofSourceDetail("/zhengwuxinxi/caijingshidian/xinhuanet/")
const jjrbDetail = makeMofSourceDetail("/zhengwuxinxi/caijingshidian/jjrb/")
const jjckbDetail = makeMofSourceDetail("/zhengwuxinxi/caijingshidian/jjckb/")
const zgcjbDetail = makeMofSourceDetail("/zhengwuxinxi/caijingshidian/zgcjb/")
const cjzylmDetail = makeMofSourceDetail("/zhengwuxinxi/caijingshidian/cjzylm/")

export const details = defineSourceDetail({
  "mof": czxwDetail,
  "mof-czxw": czxwDetail,
  "mof-zyzfmhwz": zyzfmhwzDetail,
  "mof-renminwang": renminwangDetail,
  "mof-xinhuanet": xinhuanetDetail,
  "mof-jjrb": jjrbDetail,
  "mof-jjckb": jjckbDetail,
  "mof-zgcjb": zgcjbDetail,
  "mof-cjzylm": cjzylmDetail,
})

export default defineSource({
  "mof": czxw,
  "mof-czxw": czxw,
  "mof-zyzfmhwz": zyzfmhwz,
  "mof-renminwang": renminwang,
  "mof-xinhuanet": xinhuanet,
  "mof-jjrb": jjrb,
  "mof-jjckb": jjckb,
  "mof-zgcjb": zgcjb,
  "mof-cjzylm": cjzylm,
})
