const { spawn, spawnSync } = require('child_process')
const chokidar = require('chokidar')
const fs = require('fs')
const path = require('path')

const root = process.cwd()
const viteCache = path.join(root, 'node_modules', '.vite')

let child = null

function startDev() {
  child = spawn('npm', ['run', 'dev'], { stdio: 'inherit', shell: true })
}

function stopDev() {
  if (child && !child.killed) {
    child.kill('SIGTERM')
  }
  child = null
}

function cleanCache() {
  try { fs.rmSync(viteCache, { recursive: true, force: true }) } catch {}
  try { spawnSync('npm', ['cache', 'clean', '--force'], { stdio: 'inherit', shell: true }) } catch {}
}

startDev()

const watcher = chokidar.watch([
  'components/**/*',
  'pages/**/*',
  'router.tsx',
  'App.tsx',
  'index.html',
  'vite.config.ts',
  'style.css',
  'supabaseClient.ts'
], { ignoreInitial: true })

let timer = null
function scheduleRestart() {
  clearTimeout(timer)
  timer = setTimeout(() => {
    stopDev()
    cleanCache()
    startDev()
  }, 500)
}

watcher.on('all', scheduleRestart)

process.on('SIGINT', () => {
  watcher.close()
  stopDev()
  process.exit(0)
})
