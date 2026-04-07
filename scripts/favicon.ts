import fs from "node:fs"

import { fileURLToPath } from "node:url"
import { isAbsolute, join } from "node:path"
import { Buffer } from "node:buffer"
import { consola } from "consola"
import { originSources } from "../shared/pre-sources"

const projectDir = fileURLToPath(new URL("..", import.meta.url))
const iconsDir = join(projectDir, "public", "icons")
async function downloadImage(url: string, outputPath: string, id: string) {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`${id}: could not fetch ${url}, status: ${response.status}`)
    }

    const image = await response.arrayBuffer()
    fs.writeFileSync(outputPath, Buffer.from(image))
    consola.success(`${id}: downloaded successfully.`)
    return true
  } catch (error) {
    consola.error(`${id}: error downloading the image. `, error)
    return false
  }
}

function resolveIconPath(icon: string) {
  if (isAbsolute(icon)) return icon
  return fs.existsSync(join(projectDir, icon))
    ? join(projectDir, icon)
    : join(iconsDir, icon)
}

async function downloadOrCopyIcon(id: string, icon: string, outputPath: string) {
  if (!icon) return false
  if (/^https?:\/\//i.test(icon)) {
    return await downloadImage(icon, outputPath, id)
  }

  const iconPath = resolveIconPath(icon)
  if (!fs.existsSync(iconPath)) {
    consola.warn(`${id}: configured icon not found: ${icon}`)
    return false
  }

  try {
    fs.copyFileSync(iconPath, outputPath)
    consola.success(`${id}: copied icon from ${icon}.`)
    return true
  } catch (error) {
    consola.error(`${id}: error copying configured icon ${icon}.`, error)
    return false
  }
}

async function main() {
  await Promise.all(
    Object.entries(originSources).map(async ([id, source]) => {
      try {
        const outputPath = join(iconsDir, `${id}.png`)
        if (fs.existsSync(outputPath) && !source.icon) {
          // consola.info(`${id}: icon exists. skip.`)
          return
        }

        if (source.icon) {
          const ok = await downloadOrCopyIcon(id, source.icon, outputPath)
          if (ok) return
        }

        if (!source.home) return
        await downloadImage(`https://icons.duckduckgo.com/ip3/${source.home.replace(/^https?:\/\//, "").replace(/\/$/, "")}.ico`, outputPath, id)
      } catch (e) {
        consola.error(id, "\n", e)
      }
    }),
  )
}

main()
