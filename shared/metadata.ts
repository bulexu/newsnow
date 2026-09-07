import { sources } from "./sources"
import { typeSafeObjectEntries, typeSafeObjectFromEntries } from "./type.util"
import { updatedSourceIds as _updatedSourceIds } from "./updated-sources"
import type { ColumnID, HiddenColumnID, Metadata, SourceID } from "./types"

export const columns = {
  "china": {
    zh: "国内",
  },
  "world": {
    zh: "国际",
  },
  "tech": {
    zh: "科技",
  },
  "finance": {
    zh: "财经",
  },
  "sports": {
    zh: "体育",
  },
  "focus": {
    zh: "关注",
  },
  "realtime": {
    zh: "实时",
  },
  "hottest": {
    zh: "最热",
  },
  "cycle-track": {
    zh: "自行车赛道",
  },
  "bike-industry": {
    zh: "自行车产业",
  },
  "competition": {
    zh: "竞对",
  },
  "affair": {
    zh: "政务",
  },
  "industry": {
    zh: "行业",
  },
  "updated": {
    zh: "更新",
  },
} as const

const updatedSourceIds = [..._updatedSourceIds] as SourceID[]

export const fixedColumnIds = ["focus", "hottest", "realtime", "affair", "industry", "updated"] as const satisfies Partial<ColumnID>[]
export const hiddenColumns = Object.keys(columns).filter(id => !fixedColumnIds.includes(id as any)) as HiddenColumnID[]

// 归属于可见栏目(fixedColumnIds, 如 "政务")的源已有专属 Tab,
// 不再重复计入 "最热/实时" 聚合, 避免同一源在两个 Tab 重复出现
function inFixedColumn(column?: ColumnID) {
  return !!column && (fixedColumnIds as readonly ColumnID[]).includes(column)
}

export const metadata: Metadata = typeSafeObjectFromEntries(typeSafeObjectEntries(columns).map(([k, v]) => {
  switch (k) {
    case "focus":
      return [k, {
        name: v.zh,
        sources: [] as SourceID[],
      }]
    case "hottest":
      return [k, {
        name: v.zh,
        sources: typeSafeObjectEntries(sources).filter(([, v]) => v.type === "hottest" && !v.redirect && !inFixedColumn(v.column)).map(([k]) => k),
      }]
    case "realtime":
      return [k, {
        name: v.zh,
        sources: typeSafeObjectEntries(sources).filter(([, v]) => v.type === "realtime" && !v.redirect && !inFixedColumn(v.column)).map(([k]) => k),
      }]
    case "updated":
      return [k, {
        name: v.zh,
        sources: updatedSourceIds.filter(id => sources[id] && !sources[id].redirect),
      }]
    default:
      return [k, {
        name: v.zh,
        sources: typeSafeObjectEntries(sources).filter(([, v]) => v.column === k && !v.redirect).map(([k]) => k),
      }]
  }
}))
