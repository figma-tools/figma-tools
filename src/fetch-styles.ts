import * as Figma from 'figma-js'

import { getFile } from './get-file'

function flattenTree(arr = []): Figma.Node[] {
  return arr.reduce((a, b) => a.concat([b, ...flattenTree(b.children)]), [])
}

export async function fetchStyles(fileId: string) {
  const file = await getFile(fileId)
  const flatTree = flattenTree(file.document.children as Figma.Node[])
  const styleEntries = Object.entries(file.styles)

  const colorStyles = Object.fromEntries(
    styleEntries
      .filter(([, node]) => node.styleType === 'FILL')
      .map(([id, node]) => [
        node.name,
        {
          description: node.description,
          value: (flatTree.find((node: any) => {
            return (node.styles?.fills || node.styles?.fill) === id
          }) as Figma.Frame | Figma.Vector).fills,
        },
      ])
  )

  const textStyles = Object.fromEntries(
    styleEntries
      .filter(([, node]) => node.styleType === 'TEXT')
      .map(([id, node]) => [
        node.name,
        {
          description: node.description,
          value: (flatTree
            .filter(node => node.type === 'TEXT')
            .find((node: any) => node.styles?.text === id) as Figma.Text).style,
        },
      ])
  )

  return {
    colorStyles,
    textStyles,
  }
}
