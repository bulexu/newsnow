import { load } from "cheerio"
import { normalizeText } from "#/utils/banner"

const API = "https://www.ziv-zweirad.de/wp-json/wp/v2/posts?per_page=30&_fields=id,date,link,title,excerpt"

interface WordPressPost {
  id: number
  date: string
  link: string
  title: { rendered: string }
  excerpt: { rendered: string }
}

function textFromHtml(html?: string) {
  return normalizeText(load(html || "").text())
}

// 德国两轮车工业协会 Zweirad-Industrie-Verband (ZIV) 新闻稿
export default defineSource(async () => {
  const posts: WordPressPost[] = await myFetch(API)
  return posts.map(post => ({
    id: post.id,
    title: textFromHtml(post.title?.rendered),
    url: post.link,
    pubDate: new Date(post.date).getTime(),
    extra: {
      hover: textFromHtml(post.excerpt?.rendered) || undefined,
    },
  }))
})
