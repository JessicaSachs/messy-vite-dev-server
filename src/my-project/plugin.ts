import { createServer as viteCreateServer, normalizePath, build } from 'vite'
import cyPlugin, { checkRouteMatch } from './cy-plugin'
import fs, { promises as fsp } from 'fs'
import serveStatic from 'serve-static'
import connect from 'connect'
import { parse, join, resolve } from 'path';

import { getPort } from 'get-port-please'

const inCI = false
const outDir = 'dist-cypress'
const files = [normalizePath('./src/App.cy.ts'), normalizePath('./src/components/HelloWorld.cy.ts'), normalizePath('./src/smoke.cy.ts')]

const config = {
  build: {
    outDir,
    minify: false
  },
  plugins: [
    cyPlugin({
      files,
    })
  ]
}

if (false) {
  const port = await getPort()
  const hasBuilt = fs.existsSync(outDir)
  // cache if we're in CI
  if (inCI && hasBuilt) {
    console.log('serving cached outDir')
  } else {
    const out = await build(config)
    console.log('completed build', {out})
  }

  const _static = serveStatic(outDir, { test: ['test.html'], index: ['index.html'] })
  const app = connect()
  const getTemplate = fsp.readFile(resolve(outDir, 'test.html'), 'utf8');

  app.use(async (req, res, next) => {
    const { currentSpecFile } = checkRouteMatch(files, req)
    if (currentSpecFile) {
      const template = await getTemplate
      const script = `<script type="module" src="./${parse(currentSpecFile).name}.js"></script>`
      return res.end(template.replace('</body>', `${script}</body>`))
    }
    return next()
  })

  app.use(_static)

  app.use('/', async (req, res) => {
    return res.end(`<html><body><h1>404 - Not Found</h1></body></html>`)
  });

  app.listen(port)
  console.log('listening on', port)
}

else {
  const server = await viteCreateServer(config)
  console.log(server.printUrls())

  server.listen()
}
