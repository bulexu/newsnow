import { load } from "cheerio"

interface WahooProduct {
  brand: string
  name: string
  url: string
  coin_type: string
}

interface WahooPriceItem extends WahooProduct {
  sale_price: number
}

const products: WahooProduct[] = [
  {
    name: "Zwift Ride + KICKR CORE2",
    brand: "WAHOO",
    url: "https://www.wahoofitness.com/devices/indoor-cycling/bike-trainer-bundles/zwift-bundles/kickr-core-2-zwift-ride-buy",
    coin_type: "$",
  },
  {
    name: "KICKR CORE 2 + Zwift cog and click",
    brand: "WAHOO",
    url: "https://www.wahoofitness.com/devices/indoor-cycling/bike-trainers/kickr-core-2-zwift-cog-and-click-buy",
    coin_type: "$",
  },
  {
    name: "KICKR",
    brand: "WAHOO",
    url: "https://www.wahoofitness.com/devices/indoor-cycling/bike-trainers/kickr-buy",
    coin_type: "$",
  },
  {
    name: "KICKR MOVE",
    brand: "WAHOO",
    url: "https://www.wahoofitness.com/devices/indoor-cycling/bike-trainers/kickr-move-buy",
    coin_type: "$",
  },
  {
    name: "KICKR BIKE PRO",
    brand: "WAHOO",
    url: "https://www.wahoofitness.com/devices/indoor-cycling/smart-bikes/kickr-bike-pro-buy",
    coin_type: "$",
  },
  {
    name: "KICKR ROLLR",
    brand: "WAHOO",
    url: "https://www.wahoofitness.com/devices/indoor-cycling/bike-trainers/kickr-rollr-buy",
    coin_type: "$",
  },
  {
    name: "KICKR Climb Indoor",
    brand: "WAHOO",
    url: "https://www.wahoofitness.com/devices/indoor-cycling/accessories/kickr-climb-buy",
    coin_type: "$",
  },
  {
    name: "KICKR Headwind",
    brand: "WAHOO",
    url: "https://www.wahoofitness.com/devices/indoor-cycling/accessories/kickr-headwind-buy-us",
    coin_type: "$",
  },
]

function toPrice(value?: string) {
  if (!value) return Number.NaN
  return Number(value.replace(/[,$\s]/g, ""))
}

async function fetchProductPrice(product: WahooProduct): Promise<WahooPriceItem> {
  const html: string = await myFetch(product.url)
  const $ = load(html)

  // og:price:amount 由服务端写入 <head>，唯一对应主商品价
  const sale_price = toPrice($("meta[property='og:price:amount']").attr("content"))

  if (Number.isNaN(sale_price)) {
    throw new TypeError(`Cannot parse sale price for ${product.name}`)
  }

  return {
    ...product,
    sale_price,
  }
}

export default defineSource(async () => {
  const items = await Promise.all(products.map(fetchProductPrice))

  return items.map(item => ({
    id: item.url,
    title: `${item.brand} ${item.name}`,
    url: item.url,
    content: JSON.stringify(item),
    extra: {
      info: `${item.coin_type}${item.sale_price.toFixed(2)}`,
      hover: `brand=${item.brand}\nname=${item.name}\nsale_price=${item.sale_price}\ncoin_type=${item.coin_type}`,
    },
  }))
})
