import process from "node:process"

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

  const rate = Number(res.result.rate)
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new TypeError(`Invalid fx rate ${from}->${to}: ${res.result.rate}`)
  }

  // 缓存 30 分钟，避免高频触发第三方 API 限流。
  cache.set(cacheKey, { rate, expiresAt: now + 30 * 60 * 1000 })
  return rate
}
