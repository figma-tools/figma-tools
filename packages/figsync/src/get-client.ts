import * as Figma from 'figma-js'

let client = null

export function getClient(): Figma.ClientInterface {
  if (client === null) {
    client = Figma.Client({ personalAccessToken: process.env.FIGMA_TOKEN })
  }
  return client
}
