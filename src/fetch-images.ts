import * as Figma from 'figma-js'
import { processFile } from 'figma-transformer'
import chunk from 'chunk'
import https from 'https'

import { getClient } from './get-client'
import { getFile } from './get-file'
import { incrementIds } from './utils'

const MAX_CHUNK_SIZE = 1000
const MAX_RETRIES = 3
const IMAGE_FETCH_TIMEOUT = 10000

function getImageFromSource(
  url,
  page,
  retries = MAX_RETRIES,
  timeout = IMAGE_FETCH_TIMEOUT,
  onEvent?: (event: EventTypes) => void
) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { timeout }, (response) => {
      if (response.statusCode === 200) {
        const body = []
        response.on('data', (data) => {
          body.push(data)
        })
        response.on('end', () => {
          resolve(Buffer.concat(body))
        })
      } else {
        reject(
          new Error(
            `Failed to fetch image from ${url}. Status code: ${response.statusCode}`
          )
        )
      }
    })

    request.on('error', (error) => {
      if (retries > 0) {
        onEvent?.({
          pageName: page.name,
          type: 'image',
          status: 'error',
          url,
          retriesLeft: retries,
          error,
        })

        getImageFromSource(url, page, retries - 1, timeout)
          .then(resolve)
          .catch(reject)
      } else {
        reject(new Error(`Failed to fetch image from after multiple retries.`))
      }
    })

    request.setTimeout(timeout, () => {
      request.abort()
      if (retries > 0) {
        onEvent?.({
          pageName: page.name,
          type: 'image',
          status: 'error',
          url,
          retriesLeft: retries,
          error: new Error(`Timed out fetching image from`),
        })

        getImageFromSource(url, page, retries - 1, timeout)
          .then(resolve)
          .catch(reject)
      } else {
        reject(
          new Error(
            `Timed out while fetching image from ${url} after multiple retries.`
          )
        )
      }
    })
  })
}

export type Component = {
  id: string
  name: Figma.ComponentMetadata['name']
  description: Figma.ComponentMetadata['description']
  width: number
  height: number
  pageName: string
  frameName: string | null
  groupName: string | null
  parentName: string | null
}

export type Image = {
  buffer: Buffer
} & Component

export type EventTypes = { pageName: string } & (
  | { type: 'sources'; status: 'fetching' }
  | { type: 'sources'; status: 'fetched' }
  | { type: 'images'; status: 'fetching' }
  | { type: 'images'; status: 'fetched' }
  | {
      type: 'image'
      status: 'error'
      url: string
      retriesLeft: number
      error: Error
    }
)

export type ImageOptions = {
  /** The file id to fetch images from. Located in the URL of the Figma file. */
  fileId: string

  /** The page name[s] to fetch images from */
  pages?: string[]

  /** Filter images to fetch. Fetches all images if omitted. */
  filter?: (component: Component) => boolean

  /** The event type as it occurs. */
  onEvent?: (event: EventTypes) => void

  /** Time in MS before a image fetch will timeout and retry */
  fetchTimeout?: number

  /** Maximum number of retries before any individual image fetch will fail */
  fetchMaxRetries?: number

  /** Does an expensive DFS on all children in the page to attach the parent name */
  includeParentName?: boolean
} & Omit<Figma.FileImageParams, 'ids'>

export async function fetchImages({
  fileId,
  filter,
  onEvent,
  pages,
  fetchMaxRetries,
  fetchTimeout,
  includeParentName,
  ...options
}: ImageOptions) {
  const client = getClient()
  const fileData = await getFile(fileId)
  const file = processFile(fileData)
  const images = await Promise.all(
    file.shortcuts.pages
      .filter((page) => Boolean(page.shortcuts?.components))
      .map(async (page) => {
        if (pages && pages.includes(page.name) === false) {
          return null
        }

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

        const getElementDFS = (id: string) => {
          const dfs = (children) => {
            for (let child of children) {
              if (child.id === id) {
                return child
              }
              if (child.children) {
                const foundInChildren = dfs(child.children)
                if (foundInChildren) {
                  return foundInChildren
                }
              }
            }
            return null
          }
          return dfs(page.children)
        }

        const filteredComponents: Component[] = page.shortcuts.components
          .map((component) => {
            return {
              id: component.id,
              name: component.name,
              description: component.description,
              pageName: page.name,
              width: component.absoluteBoundingBox.width,
              height: component.absoluteBoundingBox.height,
              frameName: getParentName('frames', component.id),
              groupName: getParentName('groups', component.id),
              parentName: includeParentName
                ? // @ts-expect-error - Figma transform doesn't know that parentId is a valid property
                  getElementDFS(component.parentId)?.name || null
                : null,
            }
          })
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
          ids
            .map((id) => flatImages[id])
            .map((url) =>
              getImageFromSource(
                url,
                page,
                fetchMaxRetries || MAX_RETRIES,
                fetchTimeout || IMAGE_FETCH_TIMEOUT,
                onEvent
              )
            )
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
