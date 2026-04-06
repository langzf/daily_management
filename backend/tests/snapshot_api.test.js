'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { once } = require('events');
const { spawn } = require('child_process');

const TEST_PORT = 8790;
const TEST_DB_PATH = path.join('/tmp', `daily_management_backend_test_${Date.now()}.sqlite`);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(baseUrl, timeoutMs) {
  const endAt = Date.now() + timeoutMs;
  while (Date.now() < endAt) {
    try {
      const resp = await fetch(`${baseUrl}/health`);
      if (resp.ok) return;
    } catch (err) {
      // ignore and retry
    }
    await wait(120);
  }
  throw new Error('backend health check timeout');
}

async function main() {
  const backendProcess = spawn(process.execPath, ['backend/src/server.js'], {
    cwd: path.resolve(__dirname, '..', '..'),
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      DB_PATH: TEST_DB_PATH
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  backendProcess.stdout.on('data', (chunk) => process.stdout.write(chunk));
  backendProcess.stderr.on('data', (chunk) => process.stderr.write(chunk));

  try {
    await waitForHealth(`http://127.0.0.1:${TEST_PORT}`, 8000);

    const payload = {
      userId: 'integration_user',
      data: {
        daily_todos: [
          {
            id: 'todo_1',
            text: 'integration-task',
            done: false,
            priority: 'high',
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        ],
        daily_habits: [
          {
            id: 'habit_1',
            name: 'drink-water',
            streak: 2,
            checkedToday: true,
            lastCheckDate: '2026-04-06',
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        ],
        daily_schedule: [
          {
            id: 'schedule_1',
            title: 'integration-meeting',
            dateText: '2026-04-07',
            timeText: '09:30',
            timestamp: Date.now() + 3600,
            tag: 'work',
            done: false,
            remindEnabled: true,
            remindBeforeMin: 15,
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
        ],
        daily_finance: [
          {
            id: 'bill_1',
            note: 'integration-lunch',
            amount: 22.5,
            type: 'expense',
            category: 'food',
            dateText: '2026-04-06',
            monthKey: '2026-04',
            timestamp: Date.now(),
            createdAt: Date.now()
          }
        ]
      }
    };

    const putResp = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/snapshot`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
    assert.strictEqual(putResp.status, 200);

    const getResp = await fetch(`http://127.0.0.1:${TEST_PORT}/api/v1/snapshot?userId=integration_user`);
    assert.strictEqual(getResp.status, 200);

    const body = await getResp.json();
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.data.daily_todos.length, 1);
    assert.strictEqual(body.data.daily_habits.length, 1);
    assert.strictEqual(body.data.daily_schedule.length, 1);
    assert.strictEqual(body.data.daily_finance.length, 1);
    assert.strictEqual(body.data.daily_todos[0].text, 'integration-task');

    console.log('backend-integration-ok');
  } finally {
    backendProcess.kill('SIGINT');
    await Promise.race([once(backendProcess, 'exit'), wait(1000)]);
    if (fs.existsSync(TEST_DB_PATH)) {
      fs.rmSync(TEST_DB_PATH, { force: true });
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
