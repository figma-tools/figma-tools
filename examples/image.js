#!/usr/bin/env node
const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')
const { kebabCase } = require('case-anything')
const { fetchImages } = require('../dist/index')

dotenv.config()

fetchImages({
  fileId: 'z4b1YyN4RVdT5DHK5NPGAa',
  format: 'png',
  filter: component => component.name === 'Logo',
}).then(images => {
  images.forEach(image => {
    fs.writeFileSync(
      path.resolve(`images/${kebabCase(image.name)}.png`),
      image.buffer
    )
  })
})
