import { load } from "cheerio"
import { normalizeText } from "#/utils/banner"

// activities 分类 id=6751
const API = "https://cycling.org.tw/wp-json/wp/v2/posts?categories=6751&per_page=30&_fields=id,date,link,title,excerpt"

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

// 中华台北自由车协会 Chinese Taipei Cycling Association
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
