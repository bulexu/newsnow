import process from "node:process"
import { load } from "cheerio"

interface TianApiFxRateResult {
  fromcoin: string
  tocoin: string
  money: string
  amount: string
  rate: string
  updatetime?: string
}

interface TianApiFxRateResponse {
  code: number
  msg: string
  result?: TianApiFxRateResult
}

const cache = new Map<string, { rate: number, expiresAt: number }>()

async function getFxRateFromBaidu(from: string, to: string): Promise<number> {
  const html = await myFetch<string>("https://www.baidu.com/s", {
    query: {
      wd: `${from}to${to}汇率`,
    },
    timeout: 8000,
    retry: 1,
  })

  const $ = load(html)

  // 优先解析百度汇率组件 DOM：drop-down-wrapper 内两个输入框（源币种、目标币种）
  const inputValues = $("[class*='drop-down-wrapper'] textarea[class*='select-input']")
    .map((_, el) => Number($(el).text().trim().replace(/,/g, "")))
    .get()
    .filter(v => Number.isFinite(v) && v > 0)

  if (inputValues.length >= 2) {
    const fromValue = inputValues[0]
    const toValue = inputValues[1]
    const rate = toValue / fromValue
    if (Number.isFinite(rate) && rate > 0) {
      return rate
    }
  }

  throw new TypeError(`Failed to parse fx rate from Baidu page: ${from}->${to}`)
}

export async function getRealtimeFxRate(fromcoin: string, tocoin: string): Promise<number> {
  const from = fromcoin.toUpperCase()
  const to = tocoin.toUpperCase()
  const cacheKey = `${from}_${to}`
  const now = Date.now()

  const hit = cache.get(cacheKey)
  if (hit && hit.expiresAt > now) {
    return hit.rate
  }

  const key = process.env.TIANAPI_KEY ?? "ada9fc6c496bc855b2782a88cf6e2780"
  const form = new URLSearchParams({
    key,
    money: "1",
    fromcoin: from,
    tocoin: to,
  })

  try {
    const res = await myFetch<TianApiFxRateResponse>("https://apis.tianapi.com/fxrate/index", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    })

    if (res.code !== 200 || !res.result) {
      throw new TypeError(`Failed to get fx rate ${from}->${to}: ${res.msg}`)
    }

    // money 是输入金额(这里固定 1)，真正汇率取 rate；amount 也可作为备用。
    const rate = Number(res.result.money)
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new TypeError(`Invalid fx rate ${from}->${to}: ${res.result.money}`)
    }

    // 缓存 30 分钟，避免高频触发第三方 API 限流。
    cache.set(cacheKey, { rate, expiresAt: now + 30 * 60 * 1000 })
    return rate
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    console.error(`[fxrate] TianAPI failed ${from}->${to}: ${reason}`)

    // 降级来源：百度页面检索结果。
    const rate = await getFxRateFromBaidu(from, to)
    cache.set(cacheKey, { rate, expiresAt: now + 10 * 60 * 1000 })
    return rate
  }
}
