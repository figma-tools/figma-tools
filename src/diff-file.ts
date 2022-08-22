import { FileResponse } from 'figma-js'
import { diff } from 'jest-diff'

/** Determine changes between two file responses returned from [getFile]. */
export function diffFile(fileA: FileResponse, fileB: FileResponse) {
  return diff(fileA, fileB, {
    contextLines: 0,
    expand: false,
    omitAnnotationLines: true,
    includeChangeCounts: false,
  })
}
