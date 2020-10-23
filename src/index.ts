import * as Figma from 'figma-js'
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
        const body = []
        response.on('data', data => {
          body.push(data)
        })
        response.on('end', () => {
          resolve(Buffer.concat(body))
        })
      } else {
        reject(response.statusCode)
      }
    })
  })
}

function replaceValue(match, start, tag, middle, end) {
  return `${start}${filterId}_${middle}${end}`
}

function incrementFilterId(str) {
  filterId++
  return str
    .replace(/((filter|fill)="url\(#)(.*)(\)")/g, replaceValue)
    .replace(
      /(<(filter|linearGradient) id=")([\s\S]*?)(" [\s\S]*?>)/g,
      replaceValue
    )
}

export type Component = {
  id: string
  name: Figma.ComponentMetadata['name']
  description: Figma.ComponentMetadata['description']
  pageName: string
  frameName: string | null
  groupName: string | null
}

export type Image = {
  buffer: Buffer
} & Component

export type ImageOptions = {
  /** The file id to fetch images from. Located in the URL of the Figma file. */
  fileId: string

  /** Filter images to fetch. Fetches all images if omitted. */
  filter?: (component: Component) => boolean
} & Omit<Figma.FileImageParams, 'ids'>

export async function fetchImages({
  fileId,
  filter,
  ...options
}: ImageOptions) {
  const client = Figma.Client({ personalAccessToken: process.env.FIGMA_TOKEN })
  const { data } = await client.file(fileId)
  const file = processFile(data)
  const images = await Promise.all(
    file.shortcuts.pages
      .filter(page => Boolean(page.shortcuts.components))
      .map(async page => {
        const getParentName = (key, id) => {
          if (page.shortcuts[key]) {
            const entity = page.shortcuts[key].find(group =>
              group.shortcuts.components
                ? group.shortcuts.components.some(
                    component => component.id === id
                  )
                : false
            )
            return entity ? entity.name : null
          } else {
            return null
          }
        }
        const filteredComponents: Component[] = page.shortcuts.components
          .map(component => ({
            id: component.id,
            name: component.name,
            description: component.description,
            pageName: page.name,
            frameName: getParentName('frames', component.id),
            groupName: getParentName('groups', component.id),
          }))
          .filter(component => (filter ? filter(component) : true))
        const ids = filteredComponents.map(component => component.id)
        const chunkSize = Math.round(
          ids.length / Math.ceil(ids.length / MAX_CHUNK_SIZE)
        )

        if (ids.length === 0) {
          return null
        }

        let spinner = ora(`Fetching "${page.name}" sources`).start()
        const imageChunks = await Promise.all(
          chunk(ids, chunkSize).map(chunkIds =>
            client.fileImages(fileId, {
              ids: chunkIds,
              svg_include_id: true,
              ...options,
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

        spinner.text = `Fetched "${page.name}" images`
        spinner.succeed()

        const imageBuffers = imageSources
          .map(image =>
            options.format === 'svg'
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
          const component = filteredComponents.find(
            component => component.id === id
          )
          return {
            ...component,
            buffer,
          }
        })
      })
  )
  return images
    .filter(Boolean)
    .reduce((flatImages, images) => [...flatImages, ...images], []) as Image[]
}
