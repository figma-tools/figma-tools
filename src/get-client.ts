import * as Figma from 'figma-js'

let client = null

export function getClient(): Figma.ClientInterface {
  if (client === null) {
    if (!process.env.FIGMA_TOKEN) {
      throw new Error(
        [
          'FIGMA_TOKEN environment variable is not set.',
          'You must include a personal access token in a .env file at the root of your project or as an environment variable.',
          'Learn more: https://www.figma.com/developers/docs#auth-dev-token',
        ].join('\n')
      )
    }

    client = Figma.Client({ personalAccessToken: process.env.FIGMA_TOKEN })
  }
  return client
}
