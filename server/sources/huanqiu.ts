interface Item {
  aid: string
  title: string
  summary: string
  ctime: string
  host: string
}

interface Res {
  list: Item[]
}

function makeHuanqiuSource(apiUrl: string) {
  return defineSource(async () => {
    const res: Res = await myFetch(apiUrl, { parseResponse: JSON.parse })
    return (res.list ?? [])
      .filter(k => k.aid && k.title)
      .map(k => ({
        id: k.aid,
        title: k.title,
        url: `https://${k.host}/article/${k.aid}`,
        pubDate: Number(k.ctime),
        extra: k.summary ? { hover: k.summary } : undefined,
      }))
  })
}

const finance = makeHuanqiuSource("https://finance.huanqiu.com/api/list?node=%22/e3pmh1hmp/e3pmh28kq%22,%22/e3pmh1hmp/e3pn61chp%22,%22/e3pmh1hmp/e3ptkencb%22,%22/e3pmh1hmp/e3pn47c56%22,%22/e3pmh1hmp/e3pn61an9%22,%22/e3pmh1hmp/e7i6qafud%22,%22/e3pmh1hmp/e3pn47igg%22,%22/e3pmh1hmp/e3pmh1iab%22,%22/e3pmh1hmp/e3pn61831%22,%22/e3pmh1hmp/e3pn62ihu%22,%22/e3pmh1hmp/e3pmh2bsv%22,%22/e3pmh1hmp/e3pmh2bsv/e3pn603rc%22,%22/e3pmh1hmp/e3pn61fkq%22,%22/e3pmh1hmp/fu13fv4i5%22&offset=0&limit=24")
const tech = makeHuanqiuSource("https://tech.huanqiu.com/api/list?node=%22/e3pmh164r/e3pmh33i9%22,%22/e3pmh164r/e3pmtm015%22,%22/e3pmh164r/e3pn60k1f%22,%22/e3pmh164r/e3pmh3dh4%22,%22/e3pmh164r/e3pn46ot6%22,%22/e3pmh164r/e3pmtmdvg%22,%22/e3pmh164r/e3pmh2hq8%22,%22/e3pmh164r/e3pn4sfhb%22,%22/e3pmh164r/e3pmtod3t%22,%22/e3pmh164r/e3pn4gh77%22,%22/e3pmh164r/e3pmtlao3%22&offset=0&limit=24")
const capital = makeHuanqiuSource("https://capital.huanqiu.com/api/list?node=%22/e5d59phvs/e5d5m10mv%22,%22/e5d59phvs/e63j24g2m%22,%22/e5d59phvs/evq0lg1h3%22,%22/e5d59phvs/evq0lkmga%22,%22/e5d59phvs/evq1mo2qf%22,%22/e5d59phvs/evq1mo2qf/evq1msmdn%22,%22/e5d59phvs/evq1mv740%22,%22/e5d59phvs/f29f7sbm1%22&offset=0&limit=24")

export default defineSource({
  "huanqiu": finance,
  "huanqiu-news": finance,
  "huanqiu-tech": tech,
  "huanqiu-capital": capital,
})
