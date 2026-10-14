import express from 'express';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const app = express();
const PORT = 5001;
const here = path.dirname(fileURLToPath(import.meta.url));
const binary = path.resolve(here, '../build/pulsesched_engine');

app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, engine: 'C++17', message: 'PulseSched-X API is running' });
});

app.post('/api/simulate', (req, res) => {
  const { processes, algorithm = 'Adaptive', quantum = 3 } = req.body ?? {};
  if (!Array.isArray(processes) || processes.length === 0 || processes.length > 100) {
    return res.status(400).json({ error: 'Provide between 1 and 100 processes.' });
  }
  const ids = new Set();
  for (const p of processes) {
    const values = [p.pid, p.arrival, p.burst, p.priority, p.deadline];
    if (!values.every(Number.isFinite) || p.pid < 1 || p.arrival < 0 || p.burst < 1 || p.deadline < 0) {
      return res.status(400).json({ error: 'Each process needs a positive ID, non-negative arrival/deadline, and burst time of at least 1.' });
    }
    if (ids.has(p.pid)) return res.status(400).json({ error: 'Process IDs must be unique.' });
    ids.add(p.pid);
  }
  const allowed = ['FCFS', 'SJF', 'Round Robin', 'Priority', 'Adaptive'];
  if (!allowed.includes(algorithm)) return res.status(400).json({ error: 'Unknown scheduling algorithm.' });
  if (!Number.isInteger(quantum) || quantum < 1 || quantum > 1000) return res.status(400).json({ error: 'Quantum must be an integer from 1 to 1000.' });

  const encoded = processes.map(p => [p.pid, p.arrival, p.burst, p.priority, p.deadline].join(',')).join(';');
  execFile(binary, [algorithm, String(quantum), encoded], { timeout: 5000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({
        error: 'Could not run the C++ scheduling engine. Make sure you compiled it with the setup command.',
        detail: stderr || error.message
      });
    }
    try {
      const result = { algorithm, effectiveAlgorithm: algorithm, timeline: [], metrics: [], overall: {} };
      for (const line of stdout.trim().split('\n')) {
        const parts = line.split(',');
        if (parts[0] === 'E') {
          result.timeline.push({ pid: Number(parts[1]) === -1 ? null : Number(parts[1]), start: Number(parts[2]), end: Number(parts[3]) });
        } else if (parts[0] === 'M') {
          result.metrics.push({
            pid: Number(parts[1]), start: Number(parts[2]), completion: Number(parts[3]),
            waiting: Number(parts[4]), turnaround: Number(parts[5]), response: Number(parts[6]),
            deadlineMiss: parts[7] === '1'
          });
        } else if (parts[0] === 'O') {
          result.overall = {
            averageWaiting: Number(parts[1]), averageTurnaround: Number(parts[2]),
            averageResponse: Number(parts[3]), utilization: Number(parts[4]),
            throughput: Number(parts[5]), contextSwitches: Number(parts[6]),
            elapsed: Number(parts[7]), deadlineMisses: Number(parts[8])
          };
        } else if (parts[0] === 'A') {
          result.effectiveAlgorithm = parts[1];
          result.reason = parts.slice(2).join(',');
        }
      }
      res.json(result);
    } catch {
      res.status(500).json({ error: 'Could not parse output from the C++ engine.' });
    }
  });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`PulseSched-X API listening at http://127.0.0.1:${PORT}`);
});
