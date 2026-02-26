import type { SourceID } from "@shared/types"
import { fetchSourceDetails } from "#/services/detail"

export default defineEventHandler(async (event) => {
  const body = await readBody<{ id: SourceID, force?: boolean }>(event)
  const id = body?.id
  if (!id || !sources[id]) {
    throw createError({
      statusCode: 400,
      message: "Invalid source id",
    })
  }
  if (!sources[id].detail) {
    throw createError({
      statusCode: 400,
      message: "Source does not support detail fetch",
    })
  }

  return await fetchSourceDetails(id, body?.force === true)
})
