#!/usr/bin/env node

import { execFileSync, spawn } from 'node:child_process'
import { resolve } from 'node:path'

const spec = process.argv[2]
const port = Number(process.env.TAURI_WEBDRIVER_PORT || 4445)
const maxAttempts = Number(process.env.E2E_MAX_ATTEMPTS || 3)
const appBinary = resolve('src-tauri/target/debug/md-html-reader')

if (!spec) {
  console.error('Usage: node scripts/run-e2e.mjs <spec>')
  process.exit(2)
}

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`Invalid TAURI_WEBDRIVER_PORT: ${process.env.TAURI_WEBDRIVER_PORT}`)
  process.exit(2)
}

function listenerPids() {
  try {
    const output = execFileSync(
      'lsof',
      ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN'],
      { encoding: 'utf8' }
    )
    return output.trim().split(/\s+/).filter(Boolean).map(Number)
  } catch (error) {
    if (error.status === 1) return []
    throw error
  }
}

function processCommand(pid) {
  try {
    return execFileSync('ps', ['-p', String(pid), '-o', 'command='], { encoding: 'utf8' }).trim()
  } catch (error) {
    if (error.status === 1) return ''
    throw error
  }
}

function isRunning(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const delay = (milliseconds) => new Promise(resolveDelay => setTimeout(resolveDelay, milliseconds))

async function cleanWebDriverPort() {
  for (const pid of listenerPids()) {
    const command = processCommand(pid)
    if (!command) continue
    if (!command.includes(appBinary) && !command.endsWith('/md-html-reader')) {
      throw new Error(`Port ${port} is occupied by another process: ${command}`)
    }

    console.log(`[e2e] stopping stale app process ${pid} on port ${port}`)
    process.kill(pid, 'SIGTERM')
    for (let attempt = 0; attempt < 20 && isRunning(pid); attempt++) {
      await delay(100)
    }
    if (isRunning(pid)) process.kill(pid, 'SIGKILL')
  }
}

function runWdio() {
  return new Promise(resolveRun => {
    const child = spawn(
      'pnpm',
      ['exec', 'wdio', 'run', 'wdio.e2e.conf.ts', '--spec', spec],
      {
        env: {
          ...process.env,
          TAURI_WEBDRIVER_PORT: String(port),
        },
        stdio: 'inherit',
      }
    )

    child.once('error', error => {
      console.error(`[e2e] failed to start WDIO: ${error.message}`)
      resolveRun(1)
    })
    child.once('exit', code => resolveRun(code ?? 1))
  })
}

let exitCode = 1
for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  await cleanWebDriverPort()
  console.log(`[e2e] running ${spec}, attempt ${attempt}/${maxAttempts}, port ${port}`)
  exitCode = await runWdio()
  await cleanWebDriverPort()

  if (exitCode === 0) break
  if (attempt < maxAttempts) await delay(attempt * 1000)
}

process.exit(exitCode)
