# Figma Tools

Tools to help you programmatically interact with your Figma files.

## Install

```
yarn add figma-tools --dev
```

```
npm install figma-tools --dev
```

## Exports

<em>Please note: you must include a
<a href="https://www.figma.com/developers/docs#auth-dev-token">personal access token</a> in
a `.env` at the root of your project or as an environment variable in order for the following functions to work.
</em>

### fetchImages: ({ fileId, pages, format }) => Promise<Image[]>

Fetch image assets from a file.

### watchFile (fileId) => Promise<void> (Coming Soon)

Watch a file for changes.

### diffFile (pageA, pageB) => void (Coming Soon)

Determine the changes between two file versions.

## Usage

Once your token has been set you can use any of the provided functions in a Node script. In a simple example, we will create an `icons.js` file:

```jsx
import { fetchImages } from 'figma-tools'

fetchImages({
  fileId: 'E6didZF0rpPf8piANHABDZ',
  format: 'jpg',
}).then(images => {
  console.log(images)
})
```

Now we can call our function and fetch images from our Figma file 💰:

```bash
node icons.js
```

It's that easy! This script can hook into a build script or be used in conjunction with the `watchFile` function whenever you need to refresh your assets.

## Recipes

### PNG, JPG, SVG, or PDF

```js
import { fetchImages } from 'figma-tools'

fetchImages({
  fileId: 'E6didZF0rpPf8piANHABDZ',
  format: 'jpg',
}).then(svgs => {
  images.forEach(image => {
    fs.writeFileSync(path.resolve(`${image.name}.jpg`), image.data)
  })
})
```

### React Components

```js
import { fetchImages } from 'figma-tools'
import svgtojsx from 'svg-to-jsx'

fetchImages({
  fileId: 'E6didZF0rpPf8piANHABDZ',
  format: 'svg',
}).then(async svgs => {
  const jsx = Promise.all(svgs.map(svgtojsx))
  const data = svgs
    .map((svg, index) => `export const ${pascalcase(svg.name)} = ${jsx[index]}`)
    .join('\n')
  fs.writeFileSync(path.resolve('icons.js'), data)
})
```

### JSON

```js
import { fetchImages } from 'figma-tools'
import { parse } from 'svgson'

fetchImages({
  fileId: 'E6didZF0rpPf8piANHABDZ',
  format: 'svg',
}).then(async svgs => {
  const json = Promise.all(svgs.map(parse))
  const data = svgs.reduce(
    (data, svg, index) => ({
      ...data,
      [svg.name]: json[index],
    }),
    {}
  )
  fs.writeFileSync(path.resolve('icons.json'), JSON.stringify(data, null, 2))
})
```
