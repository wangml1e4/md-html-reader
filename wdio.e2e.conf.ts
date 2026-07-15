import { resolve } from 'node:path'

const embeddedPort = Number(process.env.TAURI_WEBDRIVER_PORT || 4445)
const appBinaryPath = resolve('src-tauri/target/debug/md-html-reader')

export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: ['./test/e2e/**/*.spec.ts'],
  maxInstances: 1,
  services: [
    [
      '@wdio/tauri-service',
      {
        appBinaryPath,
        driverProvider: 'embedded',
        embeddedPort,
        startTimeout: 90000,
        statusPollTimeout: 5000,
        captureBackendLogs: true,
      },
    ],
  ],
  capabilities: [
    {
      browserName: 'tauri',
      'tauri:options': {
        application: appBinaryPath,
      },
    },
  ],
  logLevel: 'info',
  bail: 0,
  waitforTimeout: 10000,
  connectionRetryTimeout: 90000,
  connectionRetryCount: 1,
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },
}
