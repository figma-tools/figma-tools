#!/bin/env node

import React, { useEffect } from 'react'
import { render, Text } from 'ink'
import { urls } from '@design-sdk/figma-oauth'

function App() {
  useEffect(() => {
    const oauthTokenRequestUrl = urls.oauth_token_request_url({
      client_id: '',
      client_secret: '',
      redirect_uri: '',
      code: '',
    })

    console.log(oauthTokenRequestUrl)
  }, [])

  return <Text>Welcome to FigSync</Text>
}

render(<App />)
