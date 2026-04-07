import { load } from "cheerio"
import { escapeHtml, normalizeText, toAbsoluteUrl } from "#/utils/banner"

const HOME_URL = "https://ride.lezyne.com/"

function extractText($el: cheerio.Cheerio) {
  // Prefer heading, then subheading, then fallback
  const heading = $el.find("[role=\"heading\"], .h0, h1, h2, h3").first().text()
  const subheading = $el.find("p.bold, [id^=\"subheading\"], .mobile_max_width_text").first().text()
  return normalizeText(
    heading ? `${heading}${subheading ? ` — ${subheading}` : ""}` : `${subheading}`,
  )
}

const banner = defineSource(async () => {
  const html: string = await myFetch(HOME_URL)
  const $ = load(html)
  const items: Array<{ title: string, image: string, url: string }> = []
  const seenImage = new Set<string>()

  $(".slideshow__slide").each((_, el) => {
    const $slide = $(el)
    // Desktop image
    const $img = $slide.find("img.hidden.sm\\:block, img[width='3200']").first()
    const image = toAbsoluteUrl($img.attr("src"), HOME_URL)
    if (!image || seenImage.has(image)) return
    seenImage.add(image)

    // Title
    const title = extractText($slide)

    // Button link (prefer first .button--lg)
    let url = HOME_URL
    const $btn = $slide.find("a.button--lg[href]").first()
    if ($btn.length) url = toAbsoluteUrl($btn.attr("href"), HOME_URL)

    items.push({ title: title || "Lezyne", image, url })
  })

  if (!items.length) throw new TypeError("Cannot parse Lezyne homepage banners")

  return items.map((item, index) => ({
    id: `${item.image}#${index + 1}`,
    title: item.title,
    url: item.url,
    content: `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}" />`,
    extra: {
      info: "Lezyne homepage banner",
      hover: `title=${item.title}\nimage=${item.image}`,
    },
  }))
})

export default defineSource({
  "lezyne-banner": banner,
})
