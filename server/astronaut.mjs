import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { createAssistantHealthHandler, createAstronautChatHandler } from './astronaut-handler.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
try {
  const contents = readFileSync(resolve(root, '.env'), 'utf8')
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!match || process.env[match[1]] !== undefined) continue
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2').replace(/\s+#.*$/, '')
  }
} catch (error) {
  if (error.code !== 'ENOENT') {
    console.error('Could not read the optional .env file.', error)
    process.exit(1)
  }
}

const port = Number(process.env.ASTRONAUT_PORT || 8787)
const healthHandler = createAssistantHealthHandler()
const chatHandler = createAstronautChatHandler()

const server = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/api/astronaut/health') {
    healthHandler(request, response)
    return
  }
  if (request.url !== '/api/astronaut') {
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.writeHead(404).end(JSON.stringify({ error: 'Not found' }))
    return
  }
  void chatHandler(request, response)
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Astra One astronaut API listening on http://127.0.0.1:${port}`)
})

server.on('error', (error) => {
  console.error('Could not start the astronaut API server.', error)
  process.exitCode = 1
})
