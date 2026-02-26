import { load } from "cheerio"
import type { NewsItem } from "@shared/types"

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

const czxw = makeMofNewsSource("/zhengwuxinxi/caizhengxinwen/")
const zyzfmhwz = makeMofCjsdSource("/zhengwuxinxi/caijingshidian/zyzfmhwz/")
const renminwang = makeMofCjsdSource("/zhengwuxinxi/caijingshidian/renminwang/")
const xinhuanet = makeMofCjsdSource("/zhengwuxinxi/caijingshidian/xinhuanet/")
const jjrb = makeMofCjsdSource("/zhengwuxinxi/caijingshidian/jjrb/")
const jjckb = makeMofCjsdSource("/zhengwuxinxi/caijingshidian/jjckb/")
const zgcjb = makeMofCjsdSource("/zhengwuxinxi/caijingshidian/zgcjb/")
const cjzylm = makeMofCjsdSource("/zhengwuxinxi/caijingshidian/cjzylm/")

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
