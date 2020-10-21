import { stripIndent } from 'common-tags'
import HttpErrors from 'http-errors'
import fetch from 'node-fetch'
import typeIs from 'type-is'

import { name, version } from '../package.json'

const USER_AGENT = `${name}/${version}`

/** @type {import('http').RequestListener} */
module.exports = async (req, res) => {
  try {
    let { url } = req

    if (url !== undefined) {
      if (url[0] === '/') {
        url = url.slice(1)
      }
      url = decodeURIComponent(url)
    }
    if (!url) {
      url = 'https://raw.githubusercontent.com/Gerhut/github-markdown.vercel.app/main/README.md'
    }

    const text = await (async () => {
      const response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT
        }
      })
      if (!response.ok) {
        throw new HttpErrors.BadGateway(`Content HTTP ${response.status}`)
      }

      const contentType = response.headers.get('Content-Type')
      const type = typeIs.is(contentType, ['text/plain', 'text/markdown', 'text/x-markdown'])
      if (!type) {
        throw new HttpErrors.BadGateway(`Unsupported media type: ${contentType}`)
      }

      return response.text()
    })()

    const html = await (async (text) => {
      const response = await fetch('https://api.github.com/markdown', {
        method: 'POST',
        headers: {
          'User-Agent': USER_AGENT,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      })
      if (!response.ok) {
        throw new HttpErrors.BadGateway(`GitHub HTTP ${response.status}`)
      }
      const html = await response.text()
      return stripIndent`
      <!doctype html>
      <html>
      <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1, minimal-ui">
      <title>GitHub Markdown CSS demo</title>
      <link rel="stylesheet" href="https://unpkg.com/github-markdown-css">
      <style>
            body {
              box-sizing: border-box;
              min-width: 200px;
              max-width: 980px;
              margin: 0 auto;
              padding: 45px;
            }
          </style>
      </head>
      <body>
        <article class="markdown-body">
          ${html}
        </article>
      </body>
      </html>`
    })(text)

    res.writeHead(200, {
      'Content-Type': 'text/html'
    }).end(html)
  } catch (err) {
    console.error(err)

    if (err instanceof HttpErrors.HttpError) {
      res.statusCode = err.statusCode
      return res.end(err.message + '\n')
    } else {
      res.statusCode = 500
      if (err instanceof Error) {
        return res.end(err.message + '\n')
      } else {
        return res.end(String(err) + '\n')
      }
    }
  }
}
