#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')
const svgtojsx = require('svg-to-jsx')
const { pascalCase } = require('case-anything')
const { fetchImages } = require('../dist/index')

dotenv.config()

fetchImages({
  fileId: 'E6didZF0rpPf8piANHABDZ',
  format: 'svg',
  filter: component =>
    component.pageName === 'Filled' && component.frameName === 'Action',
}).then(async svgs => {
  const jsx = await Promise.all(svgs.map(svg => svgtojsx(svg.buffer)))
  const data = svgs
    .map(
      (svg, index) =>
        `export const ${pascalCase(svg.name)} = () => ${jsx[index]}`
    )
    .join('\n')
  fs.writeFileSync(path.resolve('test/icons.js'), data)
})
