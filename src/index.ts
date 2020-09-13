#!/usr/bin/env node
import Figma from 'figma-js'
import { processFile } from 'figma-transformer'
import chunk from 'chunk'
import dotenv from 'dotenv'
import fs from 'fs'
import https from 'https'
import path from 'path'
import ora from 'ora'

dotenv.config()

const config = {
  fileId: 'E6didZF0rpPf8piANHABDZ',
  pages: ['Filled'],
  format: 'png',
}

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

const MAX_SIZE = 1000
let client = null
let filterId = -1

function sourceFileImages({ ids, ...options }) {
  const chunkSize = Math.round(ids.length / Math.ceil(ids.length / MAX_SIZE))
  let spinner = ora('Fetching sources').start()
  return Promise.all(
    chunk(ids, chunkSize).map(chunkIds =>
      client.fileImages(config.fileId, {
        ids: chunkIds,
        ...options,
      })
    )
  )
    .then(chunks =>
      chunks.reduce(
        (collected: object, { data: { images } }) => ({
          ...collected,
          ...images,
        }),
        {}
      )
    )
    .then(images => {
      spinner.text = 'Fetched sources'
      spinner.succeed()
      spinner = ora('Fetching images').start()
      return Promise.all(ids.map(key => images[key]).map(getImageFromSource))
    })
    .then(images => {
      spinner.text = 'Fetched images'
      spinner.succeed()
      return images
        .map(image =>
          config.format === 'svg'
            ? Buffer.from(incrementFilterId(image.toString()))
            : image
        )
        .reduce(
          (collection: object, image, index) => ({
            ...collection,
            [ids[index]]: image,
          }),
          {}
        )
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

if (!process.env.FIGMA_TOKEN) {
  console.error('You must define a FIGMA_TOKEN environment variable.')
  process.exit(1)
} else {
  client = Figma.Client({ personalAccessToken: process.env.FIGMA_TOKEN })
  client.file(config.fileId).then(({ data }) => {
    const file = processFile(data)
    file.shortcuts.pages.forEach(page => {
      if (config.pages.includes(page.name)) {
        const componentIds = page.shortcuts.components
          .map(component => component.id)
          .slice(0, 2)
        sourceFileImages({
          ids: componentIds,
          format: config.format,
          svg_include_id: true,
        }).then(images => {
          Object.entries(images).map(([key, value]) => {
            const name = page.shortcuts.components.find(
              component => component.id === key
            ).name
            fs.writeFileSync(path.resolve(`${name}.${config.format}`), value)
          })
        })
      }
    })
  })
}
