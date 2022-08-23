let filterId = 0

/** Uses a simple counter to increment all ids contained in an SVG file. */
export function incrementIds(svgString) {
  const ids = svgString.match(/(?<="url\(#)[a-zA-Z0-9_-]+(?=\)")/g)
  return ids
    ? ids.reduce(
        (content, id) => content.replace(new RegExp(id, 'g'), id + filterId++),
        svgString
      )
    : svgString
}
