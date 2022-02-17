import { mergeConfig, normalizePath, ViteDevServer } from 'vite';
import { decode, isSamePath } from 'ufo'
import { parse, join, resolve } from 'path';
import type { ParsedPath } from 'path'
import fs, {promises as fsp} from 'fs'
import multi from '@rollup/plugin-multi-entry'

const inCI = process.env.CI === 'true'

const cleanSpecFileName = (file) => {
  if (typeof file === 'string') file = parse(file)
  // TODO: refactor to use specFileExtension via the Cypress Config we get in.
  const possibleExtensions = ['.cy', '.spec', '.test', '-spec', '-test', '_spec']

  let cleanPath
  possibleExtensions.some(extension => {
    if (file.name.endsWith(extension)) {
      cleanPath = join('/' + file.dir, file.name.slice(0, -extension.length))
      return true
    }
  })
  return cleanPath
}

const handleIndexRoute = () => {}
export const checkRouteMatch = (files, req) => {
  const normalizedUrl = normalizePath(decode(req.originalUrl)) 
  const isIndex = isSamePath(normalizedUrl, '/index.html') || isSamePath(normalizedUrl, '/')
  const currentSpecFile = files.find(file => {

    // Is the route localhost:3000/src/App a match for the spec ./src/App.cy.ts?
    // If so, generate an HTML entry file for it.
    if (isSamePath('/' + file, decode(req.originalUrl))) return false
    return isSamePath(cleanSpecFileName(parse(file)), normalizePath(decode(req.originalUrl)))
  })

  return { isIndex, currentSpecFile }
}

export default ({ files }: { files: string[] }) => {
  const outDir = 'dist-cypress'

  return {
    name: 'cy-plugin',
    async config(config, { command }) {
      if (command === 'build') {
        const newConfig = mergeConfig(config, {
          build: {
            rollupOptions: {
              preserveEntrySignatures: true,
              preserveModules: true,
              preserveModulesRoot: true,
              output: {
                entryFileNames: '[name].js',
              },
              input: [...files, './node_modules/my-project/my-template.html'],
            }
          }
        })

        newConfig.build.rollupOptions.output.manualChunks = null
        return newConfig
      }
    },
    async closeBundle() {
      await fsp.copyFile(resolve(outDir, 'node_modules/my-project/my-index.html'), resolve(outDir, 'index.html'))
      await fsp.copyFile(resolve(outDir, 'node_modules/my-project/my-template.html'), resolve(outDir, 'test.html'))
      fsp.rmdir(resolve(outDir, 'node_modules'), { recursive: true })
    },
    configureServer(server: ViteDevServer) {
      return () => {
        const getTemplate = fsp.readFile(resolve('./node_modules/my-project', 'my-template.html'), 'utf8')
        server.middlewares.use('/', async (req, res, next) => {
          const { isIndex, currentSpecFile } = checkRouteMatch(files, req)

          if (isIndex) {
            handleIndexRoute()
            console.log({ isIndex })
            return res.end(await server.transformIndexHtml(req.url, `<html><body><h1>Hello Index</h1></body></html>`, req.originalUrl))
          }
          else if (currentSpecFile) {
            const template = await getTemplate
            const html = template.replace('</body>', `<script src="./${currentSpecFile}"></script></body>`)
            return res.end(await server.transformIndexHtml(req.url, html, req.originalUrl))
          }

          return next()
        })

        // error middleware for errors that occurred in middleware
        // declared before this
        //The 404 Route (ALWAYS Keep this as the last route)
        server.middlewares.use('/', async (req, res) => {
          return res.end(`<html><body><h1>404 - Not Found</h1></body></html>`)
        });
      }
    }
  }
}


export const merp = (virtualHtmlOptions: any): any => {
  // const {
  //   pages: pagesObj,
  //   indexPage = 'index',
  //   render: globalRender = (template: string) => template,
  //   data: globalData = {},
  // } = virtualHtmlOptions
  // let pages: Pages
  // if (pagesObj === true || pagesObj === undefined) {
  //   pages = findAllHtmlInProject()
  // } else {
  //   pages = pagesObj
  // }
  // let distDir: string
  // const needRemove: Array<string> = []
  // return {
  //   name: 'vite-plugin-virtual-html',
  //   configureServer(server: ViteDevServer) {
  //     // other html handled after vite's inner middlewares.
  //     return () => {
  //       server.middlewares.use('/', async (req, res, next) => {
  //         const url = decodeURI(generateUrl(req.url))
  //         // if request is not html , directly return next()
  //         if (!url.endsWith('.html') && url !== '/') {
  //           return next()
  //         }
  //         // if request / means it request indexPage page
  //         // read indexPage config ,and response indexPage page
  //         let page: string
  //         if (url === '/' || url.indexOf('index.html') >= 0) {
  //           // @ts-ignore
  //           page = await this.load(normalizePath(`/${indexPage}.html`)) ?? ''
  //         } else {
  //           // @ts-ignore
  //           page = await this.load(url) ?? ''
  //         }
  //         res.end(await server.transformIndexHtml(url, page))
  //       })
  //     }
  //   },
  //   async config(config, {command}) {
  //     if (command === 'build') {
  //       const allPage = Object.entries(pages)
  //       // copy all html which is not under project root
  //       for (const [key, value] of allPage) {
  //         const pageOption = await generatePageOptions(value, globalData, globalRender)
  //         const vHtml = path.resolve(cwd, `./${key}.html`)
  //         if (!fs.existsSync(vHtml)) {
  //           needRemove.push(vHtml)
  //           await fsp.copyFile(path.resolve(cwd, `.${pageOption.template}`), vHtml)
  //         }
  //       }
  //       console.warn('NOTICE: This plugin cannot use in library mode!')
  //       // get custom distDir config,if it is undefined use default config 'dist'
  //       distDir = config.build?.outDir ?? 'dist'
  //       // inject build.rollupOptions.input from pages directly.
  //       config.build = {
  //         ...config.build,
  //         rollupOptions: {
  //           input: {
  //             ...extractHtmlPath(pages),
  //           },
  //         },
  //       }
  //     }
  //   },
  //   async load(id: string) {
  //     if (id.endsWith('html')) {
  //       const newId = getHtmlName(id)
  //       const page = await generatePageOptions(pages[newId], globalData, globalRender)
  //       // generate html template
  //       return await readHtml(page)
  //     }
  //     return null
  //   },
  //   async closeBundle() {
  //     // remove files should not be under project root
  //     for (let vHtml of needRemove) {
  //       if (fs.existsSync(vHtml)) {
  //         await fsp.rm(vHtml).catch(() => {
  //           // ignore this warning
  //         })
  //       }
  //     }
  //   },
  // }
}
