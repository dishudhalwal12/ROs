import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import react from '@vitejs/plugin-react'
import { loadEnv, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

async function readJsonBody(request: IncomingMessage) {
  const chunks: Buffer[] = []

  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  }

  if (chunks.length === 0) {
    return undefined
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) {
    return undefined
  }

  return JSON.parse(raw)
}

function createApiResponse(response: ServerResponse) {
  let statusCode = 200

  return {
    status(code: number) {
      statusCode = code
      response.statusCode = code
      return this
    },
    json(body: unknown) {
      response.statusCode = statusCode
      if (!response.headersSent) {
        response.setHeader('Content-Type', 'application/json')
      }
      response.end(JSON.stringify(body))
    },
    setHeader(name: string, value: string) {
      response.setHeader(name, value)
    },
  }
}

function timepassDevApiPlugin(): Plugin {
  return {
    name: 'timepass-dev-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (request.url?.split('?')[0] !== '/api/livekit/token') {
          next()
          return
        }

        try {
          const module = await server.ssrLoadModule('/api/livekit/token.ts')
          const body = await readJsonBody(request)
          await module.default(
            {
              method: request.method,
              headers: request.headers,
              body,
            },
            createApiResponse(response),
          )
        } catch (error) {
          response.statusCode = 500
          response.setHeader('Content-Type', 'application/json')
          response.end(
            JSON.stringify({
              error:
                error instanceof Error
                  ? error.message
                  : 'Unable to serve the local Timepass token endpoint.',
            }),
          )
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''))

  return {
    plugins: [react(), timepassDevApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './tests/unit/setup.ts',
      css: true,
      include: ['tests/unit/**/*.test.{ts,tsx}'],
    },
  }
})
