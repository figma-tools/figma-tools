#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')
const { parse } = require('svgson')
const { fetchImages } = require('../dist/index')

dotenv.config()

fetchImages({
  fileId: 'E6didZF0rpPf8piANHABDZ',
  format: 'svg',
  filter: component =>
    component.pageName === 'Filled' && component.frameName === 'Action',
}).then(async svgs => {
  const json = await Promise.all(svgs.map(svg => parse(svg.buffer.toString())))
  const data = svgs.reduce(
    (data, svg, index) => ({
      ...data,
      [svg.name]: json[index],
    }),
    {}
  )
  fs.writeFileSync(
    path.resolve('test/icons.json'),
    JSON.stringify(data, null, 2)
  )
})
