#!/usr/bin/env node
const dotenv = require('dotenv')
const { fetchStyles } = require('../dist/index')

dotenv.config()

fetchStyles('77pIvA31XYVn39bC061cjw').then(styles => {
  console.log(styles)
})
