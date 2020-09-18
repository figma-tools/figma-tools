import Figma, { ComponentMetadata, exportFormatOptions } from 'figma-js'
import { processFile } from 'figma-transformer'
import chunk from 'chunk'
import https from 'https'
import ora from 'ora'

const MAX_CHUNK_SIZE = 1000
let filterId = -1

function getImageFromSource(url) {
  return new Promise((resolve, reject) => {
    https.get(url, response => {
      if (response.statusCode === 200) {
        response.on('data', data => {
          resolve(data)
        })
      } else {
        reject(response.statusCode)
      }
    })
  })
}

function replaceValue(_, start, middle, end) {
  return `${start}${filterId}_${middle}${end}`
}

function incrementFilterId(str) {
  filterId++
  return str
    .replace(/(filter="url\(#)(.*)(\)")/g, replaceValue)
    .replace(/(<filter id=")([\s\S]*?)(" [\s\S]*?>)/g, replaceValue)
}

export type Image = {
  buffer: Buffer
  description: ComponentMetadata['description']
  name: ComponentMetadata['name']
  frameName: string
  pageName: string
}

export async function fetchImages({
  fileId,
  pages,
  format,
}: {
  /** The file id to fetch images from. Located in the URL of the Figma file. */
  fileId: string

  /** The returned image file format. */
  format: exportFormatOptions

  /** Discrete pages to fetch images from. */
  pages?: string[]
}) {
  const client = Figma.Client({ personalAccessToken: process.env.FIGMA_TOKEN })
  const { data } = await client.file(fileId)
  const file = processFile(data)
  const images = await Promise.all(
    file.shortcuts.pages
      .filter(page => {
        if (pages) {
          const includePage = pages.includes(page.name)
          if (includePage && (!page.shortcuts || !page.shortcuts.components)) {
            console.log(`No components found in "${page.name}" page.`)
            return false
          }
          return includePage
        } else {
          return true
        }
      })
      .map(async page => {
        const ids = Object.keys(data.components)
        const chunkSize = Math.round(
          ids.length / Math.ceil(ids.length / MAX_CHUNK_SIZE)
        )

        let spinner = ora(`Fetching ${page.name} sources`).start()
        const imageChunks = await Promise.all(
          chunk(ids, chunkSize).map(chunkIds =>
            client.fileImages(fileId, {
              ids: chunkIds,
              svg_include_id: true,
              format,
            })
          )
        )

        const flatImages = imageChunks.reduce(
          (collected: object, { data: { images } }) => ({
            ...collected,
            ...images,
          }),
          {}
        )

        spinner.text = `Fetched "${page.name}" sources`
        spinner.succeed()
        spinner = ora(`Fetching "${page.name}" images`).start()

        const imageSources = await Promise.all(
          ids.map(id => flatImages[id]).map(getImageFromSource)
        )

        spinner.text = `Fetched ${page.name} images`
        spinner.succeed()

        const imageBuffers = imageSources
          .map(image =>
            format === 'svg'
              ? Buffer.from(incrementFilterId(image.toString()))
              : image
          )
          .reduce(
            (collection: Record<string, Buffer>, image, index) => ({
              ...collection,
              [ids[index]]: image,
            }),
            {}
          )

        return Object.entries(imageBuffers).map(([id, buffer]) => {
          const { name, description } = data.components[id]
          const frame =
            page.shortcuts.frames &&
            page.shortcuts.frames.find(frame =>
              frame.shortcuts.components.some(component => component.id === id)
            )
          const group =
            page.shortcuts.groups &&
            page.shortcuts.groups.find(group =>
              group.shortcuts.components.some(component => component.id === id)
            )
          return {
            buffer,
            description,
            name,
            pageName: page.name,
            frameName: frame && frame.name,
            groupName: group && group.name,
          }
        })
      })
  )
  return images.reduce(
    (flatImages, images) => [...flatImages, ...images],
    []
  ) as Image[]
}
