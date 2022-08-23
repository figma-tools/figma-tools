import * as Figma from 'figma-js'
import chalk from 'chalk'

import { getClient } from './get-client'

const files = new Map()

export async function getFile(
  fileId: string,
  shouldUseCachedFile: boolean = true
): Promise<Figma.FileResponse> {
  if (shouldUseCachedFile && files.has(fileId)) {
    return files.get(fileId)
  } else {
    try {
      const { data } = await getClient().file(fileId)

      files.set(fileId, data)

      return data
    } catch ({ message }) {
      throw new Error(
        `${chalk.blue(
          `Failed to get Figma file ${chalk.magenta(
            fileId
          )}. Check to make sure you have a valid token and proper permissions to access the file:`
        )}
       https://www.figma.com/developers/docs#auth-dev-token

       ${chalk.red(message)}
        `
      )
    }
  }
}
