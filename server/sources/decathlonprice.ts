import { load } from "cheerio"
import { getRealtimeFxRate } from "../utils/fxrate"

interface DecathlonProduct {
  brand: string
  name: string
  url: string
  coin_type: string
}

interface DecathlonPriceItem extends DecathlonProduct {
  sale_price: number
  usd_price: number
  fx_rate_eur_usd: number
}

const products: DecathlonProduct[] = [
  {
    name: "D100",
    brand: "Decathlon",
    url: "https://www.decathlon.fr/p/home-trainer-d100-avec-zwift-cog-and-click/_/R-p-355194?mc=8883242",
    coin_type: "€",
  },
  {
    name: "D500",
    brand: "Decathlon",
    url: "https://www.decathlon.fr/p/home-trainer-connecte-avec-zwift-cog-and-click-d500/_/R-p-301243?mc=8551028",
    coin_type: "€",
  },
  {
    name: "HTRCR",
    brand: "Decathlon",
    url: "https://www.decathlon.fr/p/home-trainer-rcr-connecte-avec-zwift-cog-and-click/_/R-p-347879?mc=8861638",
    coin_type: "€",
  },
]

function toPrice(value?: string): number {
  if (!value) return Number.NaN
  // 处理法语格式: "239,99 €" 或 "239.99"
  return Number(value.replace(/[€\s]/g, "").replace(",", "."))
}

function getPriceFromJsonLd(raw: string): number {
  const parsed = JSON.parse(raw) as Record<string, unknown>

  // 1) 直接 Product/Offer 结构
  const directOffer = parsed.offers as Record<string, unknown> | undefined
  if (directOffer?.price !== undefined) {
    return toPrice(String(directOffer.price))
  }

  // 2) Decathlon 常见结构: { "@graph": [ProductGroup, Product] }
  const graph = Array.isArray(parsed["@graph"]) ? (parsed["@graph"] as Array<Record<string, unknown>>) : []
  const productNode = graph.find(node => node["@type"] === "Product")
  const graphOffer = productNode?.offers as Record<string, unknown> | undefined
  if (graphOffer?.price !== undefined) {
    return toPrice(String(graphOffer.price))
  }

  // 3) JSON-LD 顶层是数组
  if (Array.isArray(parsed)) {
    const item = (parsed as Array<Record<string, unknown>>).find(node => node["@type"] === "Product")
    const offer = item?.offers as Record<string, unknown> | undefined
    if (offer?.price !== undefined) {
      return toPrice(String(offer.price))
    }
  }

  return Number.NaN
}

async function fetchProductPrice(product: DecathlonProduct): Promise<DecathlonPriceItem> {
  const html: string = await flareFetch(product.url)
  console.log(`Fetched HTML for ${product.name}, length=${html.length}`)
  const $ = load(html)

  let sale_price = Number.NaN

  // 优先尝试 JSON-LD (schema.org Product)
  try {
    $("script[type=\"application/ld+json\"]").each((_, el) => {
      const text = $(el).html()
      if (!text) return
      const parsedPrice = getPriceFromJsonLd(text)
      if (!Number.isNaN(parsedPrice)) {
        sale_price = parsedPrice
      }
    })
  } catch {}

  console.log(`Parsed price from JSON-LD for ${product.name}: ${sale_price}`)

  if (Number.isNaN(sale_price)) {
    throw new TypeError(`Cannot parse sale price for ${product.name}`)
  }

  const fx_rate_eur_usd = await getRealtimeFxRate("EUR", "USD")
  console.log(`Fetched FX rate EUR->USD: ${fx_rate_eur_usd}`)
  const usd_price = sale_price * fx_rate_eur_usd

  return { ...product, sale_price, usd_price, fx_rate_eur_usd }
}

export default defineSource(async () => {
  const items = await Promise.all(products.map(fetchProductPrice))

  return items.map((item) => {
    return {
      id: item.url,
      title: `${item.brand} ${item.name}`,
      url: item.url,
      extra: {
        info: `$${item.usd_price.toFixed(2)} (${item.coin_type}${item.sale_price.toFixed(2)})`,
        hover: [
          `brand=${item.brand}`,
          `name=${item.name}`,
          `sale_price_eur=${item.sale_price}`,
          `sale_price_usd=${item.usd_price.toFixed(2)}`,
          `fx_rate_eur_usd=${item.fx_rate_eur_usd}`,
          `coin_type=${item.coin_type}`,
        ].filter(Boolean).join("\n"),
      },
    }
  })
})
