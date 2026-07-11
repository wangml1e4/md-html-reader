export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: ['./test/e2e/**/*.spec.ts'],
  maxInstances: 1,
  services: [
    [
      '@wdio/tauri-service',
      {
        appBinaryPath: './src-tauri/target/debug/md-html-reader',
        driverProvider: 'embedded',
        startTimeout: 60000,
        statusPollTimeout: 5000,
      },
    ],
  ],
  capabilities: [
    {
      browserName: 'tauri',
      'tauri:options': {
        application: './src-tauri/target/debug/md-html-reader',
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
