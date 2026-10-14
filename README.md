# PulseSched-X Demo

**Adaptive Multi-Core CPU Scheduling with Deadline and Fairness Optimization**

This is a demonstration-ready starter built with:
- React + Vite frontend
- Node.js + Express API
- C++17 scheduling engine

The C++ engine currently implements:
- FCFS
- Non-preemptive SJF
- Round Robin
- Non-preemptive Priority (smaller number means higher priority)
- Rule-based adaptive selection among the above policies
- Waiting, turnaround, response, utilization, throughput, context-switch count, and deadline-miss metrics

**Scope note:** This is a single-CPU scheduling simulation in this first runnable milestone. The UI uses a multi-core concept panel, but real multi-core scheduling is not implemented yet. The adaptive mode is a transparent heuristic, not a trained AI model. Deadlines are measured against completion time and do not guarantee real-time execution.

## Requirements
- Node.js 18+ (20+ recommended)
- CMake 3.16+
- C++17 compiler (`clang++` on macOS)

Check:
```bash
node --version
npm --version
clang++ --version
cmake --version
```

## Run on macOS

From the project root:
```bash
npm install
cmake -S engine -B build
cmake --build build
npm run dev:all
```

Open the local URL Vite prints, normally `http://127.0.0.1:5173`.

Keep the terminal running while you demonstrate. The API runs on port 5001 and Vite proxies `/api` requests to it.

## If the command `cmake` is missing
Install Apple's command line tools:
```bash
xcode-select --install
```
Then install CMake if needed with Homebrew:
```bash
brew install cmake
```

## Build frontend for production
```bash
npm run build
```

## Suggested demo flow
1. Run Adaptive with the default processes.
2. Select FCFS and run.
3. Select Round Robin, change the quantum, and run.
4. Click Compare all to compare the same workload.
5. Add or edit a process and run again.
6. Export CSV results.

## Metrics
- Waiting = turnaround - burst (for these non-preemptive algorithms and the current RR implementation, assuming one CPU and no extra overhead).
- Turnaround = completion - arrival.
- Response = first CPU start - arrival.
- Utilization = busy time / elapsed simulation time.
- Throughput = number of processes / elapsed time.
- Deadline miss = completion time > configured deadline.

The C++ engine is launched by the local Express API using validated arguments. Do not expose this local API to the public internet without adding appropriate security controls.

## New analysis features

- **Scheduler Crash-Test Lab:** choose repeatable mixed, burst-arrival, or priority-pressure workloads and compare FCFS, SJF, Round Robin, Priority, and Adaptive using the same process set.
- **Fairness Auditor:** visualizes per-process waiting times and flags potential wait disparity using an explicitly heuristic threshold. This is not a formal proof of starvation.
- **Gantt playback:** play/pause, reset, and single-time-unit stepping for the most recent simulation.
- **Dark/light theme toggle:** switch the dashboard presentation from the top bar.

These are simulation and analysis features. PulseSched-X does not change the real macOS CPU scheduler, and fairness flags are diagnostic heuristics rather than guarantees.
