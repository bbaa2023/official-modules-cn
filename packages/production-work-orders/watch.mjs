import { spawn } from 'node:child_process'
const child = spawn('node', ['build.mjs'], { stdio: 'inherit' })
child.on('exit', (code) => process.exit(code ?? 0))
