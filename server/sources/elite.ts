import { load } from "cheerio"
import { escapeHtml, normalizeText, toAbsoluteUrl } from "#/utils/banner"

const HOME_URL = "https://www.elite-it.com/en"

function titleFromImageUrl(url: string): string {
  const filename = url.split("/").pop()?.replace(/\.[^.]+$/, "") ?? ""
  return filename
    .replace(/\.\d{2}_\d{2}_\d{2}_\d{2}\.\w+$/, "")
    .replace(/^DRAFT\d+/, "")
    .replace(/[-_]+/g, " ")
    .trim()
}

const banner = defineSource(async () => {
  const html: string = await myFetch(HOME_URL)
  const $ = load(html)
  const items: Array<{ title: string, image: string }> = []
  const seen = new Set<string>()

  $(".swiper-slide.home-carousel__item").each((_, element) => {
    const $slide = $(element)
    const $img = $slide.find("img[role='presentation']").first()
    if (!$img.length) return

    const image = toAbsoluteUrl($img.attr("src"), HOME_URL)
    if (!image || seen.has(image)) return
    seen.add(image)

    const title = normalizeText(titleFromImageUrl(image))
    if (!title) return

    items.push({ title, image })
  })

  if (!items.length) {
    throw new TypeError("Cannot parse Elite homepage banners")
  }

  return items.map((item, index) => ({
    id: `${item.image}#${index + 1}`,
    title: item.title,
    url: HOME_URL,
    content: `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" />`,
    extra: {
      info: "Elite homepage banner",
      hover: `title=${item.title}\nimage=${item.image}`,
    },
  }))
})

export default defineSource({
  "elite-banner": banner,
})
