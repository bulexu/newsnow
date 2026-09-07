import { load } from "cheerio"
import { normalizeText } from "#/utils/banner"

const API = "https://www.federciclismo.it/wp-json/wp/v2/posts?per_page=30&_fields=id,date,link,title,excerpt"

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

// 意大利自行车联合会 Federciclismo (FCI)
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
