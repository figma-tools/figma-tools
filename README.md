# Figma Source

Easily source assets from a Figma file.

## Install

```
yarn add figma-source --dev
```

```
npm install figma-source --dev
```

## Exports

### sourceFileImages

Responsible for sourcing image assets from your Figma file. You must include a
[personal access token](https://www.figma.com/developers/docs#auth-dev-token) in
a `.env` at the root of your project or as an environment variable.

#### { fileId, format, size }

## Usage

Once your token has been set you can now use the function in a Node script. First, we will create an `icons.js` file:

```jsx
import { sourceFileImages } from 'figma-source'

sourceFileImages({
  fileId: 'E6didZF0rpPf8piANHABDZ',
  format: 'jpg',
  size: 2,
}).then(images => {
  // returns image Buffer
})
```

Now we can call our function and source assets from our Figma file 💰:

```bash
node icons.js
```

This script can hook into a build script or ran whenever you need to refresh your assets.

## Recipes

### Generate PNG, JPG, SVG, or PDF

```js
import { sourceFile } from 'figma-source'

const FORMAT = 'jpg'

sourceFile({
  fileId: 'E6didZF0rpPf8piANHABDZ',
  format: FORMAT,
}).then(svgs => {
  images.forEach(image => {
    fs.writeFileSync(path.resolve(`${image.name}.${FORMAT}`), image.data)
  })
})
```

### Generate React Components

```js
import { sourceFile } from 'figma-source'
import svgtojsx from 'svg-to-jsx'

const FILE_NAME = 'icons.js'

sourceFile({
  fileId: 'E6didZF0rpPf8piANHABDZ',
  format: 'svg',
}).then(svgs => {
  Promise.all(svgs.map(svgtojsx))
    .then(jsx =>
      svgs
        .map(
          (svg, index) => `export const ${pascalcase(svg.name)} = ${jsx[index]}`
        )
        .join('\n')
    )
    .then(data => {
      fs.writeFileSync(path.resolve(FILE_NAME), data)
    })
})
```

### Generate JSON File

```js
import { sourceFile } from 'figma-source'
import { parse } from 'svgson'

const FILE_NAME = 'icons.json'

sourceFile({
  fileId: 'E6didZF0rpPf8piANHABDZ',
  format: 'svg',
}).then(svgs => {
  Promise.all(svgs.map(parse))
    .then(json =>
      svgs.reduce(
        (data, svg, index) => ({
          ...data,
          [svg.name]: json[index],
        }),
        {}
      )
    )
    .then(data => {
      fs.writeFileSync(path.resolve(FILE_NAME), JSON.stringify(data, null, 2))
    })
})
```
