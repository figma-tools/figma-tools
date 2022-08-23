import { FileResponse } from 'figma-js'

import { getFile } from './get-file'

/** Watch a file for changes. */
export function watchFile(
  fileId: string,
  callback: (file: FileResponse, previousFile: FileResponse) => void,
  delay: number = 5000
) {
  let previousFile: FileResponse | null = null

  const intervalId = setInterval(async () => {
    const file = await getFile(fileId, false)

    if (
      previousFile !== null &&
      previousFile.lastModified !== file.lastModified
    ) {
      callback(file, previousFile)
    }

    previousFile = file
  }, delay)

  return () => clearInterval(intervalId)
}
