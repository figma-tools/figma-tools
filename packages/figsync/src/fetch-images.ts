import * as Figma from 'figma-js'
import { processFile } from 'figma-transformer'
import chunk from 'chunk'
import https from 'https'

import { getClient } from './get-client'
import { getFile } from './get-file'
import { incrementIds } from './utils'

const MAX_CHUNK_SIZE = 1000

function getImageFromSource(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        const body = []
        response.on('data', (data) => {
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

export type EventTypes = { pageName: string } & (
  | { type: 'sources'; status: 'fetching' }
  | { type: 'sources'; status: 'fetched' }
  | { type: 'images'; status: 'fetching' }
  | { type: 'images'; status: 'fetched' }
)

export type ImageOptions = {
  /** The file id to fetch images from. Located in the URL of the Figma file. */
  fileId: string

  /** Filter images to fetch. Fetches all images if omitted. */
  filter?: (component: Component) => boolean

  /** The event type as it occurs. */
  onEvent?: (event: EventTypes) => void
} & Omit<Figma.FileImageParams, 'ids'>

export async function fetchImages({
  fileId,
  filter,
  onEvent,
  ...options
}: ImageOptions) {
  const client = getClient()
  const fileData = await getFile(fileId)
  const file = processFile(fileData)
  const images = await Promise.all(
    file.shortcuts.pages
      .filter((page) => Boolean(page.shortcuts?.components))
      .map(async (page) => {
        const getParentName = (key, id) => {
          if (page.shortcuts[key]) {
            const entity = page.shortcuts[key].find((group) =>
              group.shortcuts?.components
                ? group.shortcuts.components.some(
                    (component) => component.id === id
                  )
                : false
            )
            return entity ? entity.name : null
          } else {
            return null
          }
        }
        const filteredComponents: Component[] = page.shortcuts.components
          .map((component) => ({
            id: component.id,
            name: component.name,
            description: component.description,
            pageName: page.name,
            frameName: getParentName('frames', component.id),
            groupName: getParentName('groups', component.id),
          }))
          .filter((component) => (filter ? filter(component) : true))
        const ids = filteredComponents.map((component) => component.id)
        const chunkSize = Math.round(
          ids.length / Math.ceil(ids.length / MAX_CHUNK_SIZE)
        )

        if (ids.length === 0) {
          return null
        }

        onEvent?.({ pageName: page.name, type: 'sources', status: 'fetching' })

        const imageChunks = await Promise.all(
          chunk(ids, chunkSize).map((chunkIds) =>
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

        onEvent?.({ pageName: page.name, type: 'sources', status: 'fetched' })

        onEvent?.({ pageName: page.name, type: 'images', status: 'fetching' })

        const imageSources = await Promise.all(
          ids.map((id) => flatImages[id]).map(getImageFromSource)
        )

        onEvent?.({ pageName: page.name, type: 'images', status: 'fetched' })

        const imageBuffers = imageSources
          .map((image) =>
            options.format === 'svg'
              ? Buffer.from(incrementIds(image.toString()))
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
            (component) => component.id === id
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
