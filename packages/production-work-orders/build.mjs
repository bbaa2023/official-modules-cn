import * as esbuild from 'esbuild'
import { glob } from 'glob'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const entryPoints = await glob('src/**/*.{ts,tsx}', { cwd: __dirname, ignore: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'], absolute: true })
if (!entryPoints.length) process.exit(1)

const addJsExtension = {
  name: 'add-js-extension',
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length) return
      const outputFiles = await glob('dist/**/*.js', { cwd: __dirname, absolute: true })
      for (const file of outputFiles) {
        const fileDir = dirname(file)
        let content = readFileSync(file, 'utf-8')
        content = content.replace(/from\s+["'](\.[^"']+)["']/g, (match, path) => {
          if (path.endsWith('.js') || path.endsWith('.json')) return match
          const resolvedPath = join(fileDir, path)
          if (existsSync(resolvedPath) && existsSync(join(resolvedPath, 'index.js'))) return `from "${path}/index.js"`
          return `from "${path}.js"`
        })
        content = content.replace(/import\s*\(\s*["'](\.[^"']+)["']\s*\)/g, (match, path) => {
          if (path.endsWith('.js') || path.endsWith('.json')) return match
          const resolvedPath = join(fileDir, path)
          if (existsSync(resolvedPath) && existsSync(join(resolvedPath, 'index.js'))) return `import("${path}/index.js")`
          return `import("${path}.js")`
        })
        writeFileSync(file, content)
      }
    })
  },
}

await esbuild.build({ entryPoints, outdir: 'dist', format: 'esm', platform: 'node', target: 'node18', sourcemap: true, jsx: 'automatic', plugins: [addJsExtension] })

const jsonFiles = await glob('src/**/*.json', { cwd: __dirname, absolute: true })
for (const file of jsonFiles) {
  const relativePath = relative(join(__dirname, 'src'), file)
  const outputFile = join(__dirname, 'dist', `${relativePath}.js`)
  mkdirSync(dirname(outputFile), { recursive: true })
  const json = readFileSync(file, 'utf-8')
  writeFileSync(outputFile, `export default ${json}\n`)
}

console.log('production-work-orders built successfully')
