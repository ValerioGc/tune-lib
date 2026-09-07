const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = process.env.E2E_PORT ?? '1421';
const baseUrl = `http://127.0.0.1:${port}`;
const viteCli = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const cucumberCli = path.join(root, 'node_modules', '@cucumber', 'cucumber', 'bin', 'cucumber.js');

/**
 * Waits for the Vite server to become ready by polling the given URL until it responds or the timeout is reached.
 * @param {string} url - The URL to poll for server readiness.
 * @param {number} timeoutMs - The maximum time to wait for the server to become ready, in milliseconds. Defaults to 30,000 ms (30 seconds).
 * @returns {Promise<void>}
 */
function waitForServer(url, timeoutMs = 30_000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const check = () => {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on('error', () => {
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error(`The Vite server did not become ready at ${url}`));
          return;
        }

        setTimeout(check, 250);
      });
    };

    check();
  });
}

function stopProcess(child) {
  if (!child.killed) {
    child.kill();
  }
}

async function run() {
  const vite = spawn(process.execPath, [viteCli, '--host', '127.0.0.1', '--port', port], {
    cwd: root,
    env: { ...process.env, BROWSER: 'none' },
    stdio: 'inherit',
  });

  try {
    await waitForServer(baseUrl);

    const cucumber = spawn(
      process.execPath,
      [
        cucumberCli,
        path.join(root, 'src', 'tests', 'e2e', 'features'),
        '--import',
        path.join(root, 'src', 'tests', 'e2e', 'support'),
        '--import',
        path.join(root, 'src', 'tests', 'e2e', 'steps'),
        '--format',
        'progress',
        '--strict',
        ...process.argv.slice(2),
      ],
      {
        cwd: root,
        env: { ...process.env, E2E_BASE_URL: baseUrl },
        stdio: 'inherit',
      },
    );

    const exitCode = await new Promise((resolve, reject) => {
      cucumber.on('error', reject);
      cucumber.on('exit', (code, signal) => resolve(code ?? (signal === null ? 1 : 1)));
    });

    process.exitCode = exitCode;
  } finally {
    stopProcess(vite);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
