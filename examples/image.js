#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')
const { kebabCase } = require('case-anything')
const { fetchImages } = require('../dist/index')

dotenv.config()

fetchImages({
  fileId: 'E6didZF0rpPf8piANHABDZ',
  format: 'jpg',
  filter: component =>
    component.pageName === 'Filled' && component.frameName === 'Action',
}).then(images => {
  images.forEach(image => {
    fs.writeFileSync(
      path.resolve(`test/${kebabCase(image.name)}.jpg`),
      image.buffer
    )
  })
})
