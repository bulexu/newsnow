import { load } from "cheerio"
import type { NewsItem } from "@shared/types"
import { normalizeText } from "#/utils/banner"

const STATISTICS_URL = "https://www.ancma.it/statistiche/"

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

// 342 = NEWS DALL'ASSOCIAZIONE, 346 = NOTIZIE DAGLI ASSOCIATI
function makeAncmaNewsSource(categoryId: number) {
  return defineSource(async () => {
    const api = `https://ancma.news/wp-json/wp/v2/posts?categories=${categoryId}&per_page=30&_fields=id,date,link,title,excerpt`
    const posts: WordPressPost[] = await myFetch(api)
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
}

const news = makeAncmaNewsSource(342)
const associates = makeAncmaNewsSource(346)

const categoryNames: Record<string, string> = {
  "biciclette": "Biciclette",
  "caschi": "Caschi",
  "ciclomotori": "Ciclomotori",
  "motocicli": "Motocicli",
  "commercio-estero": "Commercio estero",
  "produzione-italiana": "Produzione italiana",
  "quadricicli": "Quadricicli",
  "relazione-annuale": "Relazione annuale",
}

const statistics = defineSource(async () => {
  const html: string = await myFetch(STATISTICS_URL)
  const $ = load(html)
  const items: NewsItem[] = []

  $("article.statistiche").slice(0, 50).each((_, element) => {
    const article = $(element)
    const link = article.find("a[href*='.pdf']").first().attr("href")
    const title = normalizeText(article.find("h2,h3,h4,.entry-title").first().text())
    if (!link || !title) return

    const id = article.attr("id")?.replace(/^post-/, "") || link
    const categories = (article.attr("class") || "")
      .split(/\s+/)
      .filter(value => value.startsWith("categorie_statistiche-"))
      .map(value => value.replace("categorie_statistiche-", ""))
      .map(value => categoryNames[value] || value.replace(/-/g, " "))

    items.push({
      id,
      title,
      url: new URL(link, STATISTICS_URL).toString(),
      extra: {
        info: ["PDF", ...categories].join(" · "),
      },
    })
  })

  return items
})

export default defineSource({
  "ancma-news": news,
  "ancma-associates": associates,
  "ancma-statistics": statistics,
})
