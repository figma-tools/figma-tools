import * as Figma from 'figma-js'
import { getClient } from './get-client'

const files = new Map()

export async function getFile(fileId: string): Promise<Figma.FileResponse> {
  if (files.has(fileId)) {
    return files.get(fileId)
  } else {
    const { data } = await getClient().file(fileId)
    files.set(fileId, data)
    return data
  }
}
