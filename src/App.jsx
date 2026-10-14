import { useEffect, useMemo, useState } from 'react';
import {
  Activity, BrainCircuit, ChartNoAxesCombined, CircleHelp, Cpu, Download,
  Gauge, GitCompareArrows, Play, Plus, RotateCcw, ShieldCheck, Trash2, Zap, Moon, Sun, Pause, SkipForward, FlaskConical, Scale
} from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';

const demo = [
  { pid: 1, arrival: 0, burst: 7, priority: 2, deadline: 16 },
  { pid: 2, arrival: 1, burst: 4, priority: 1, deadline: 10 },
  { pid: 3, arrival: 2, burst: 5, priority: 3, deadline: 18 },
  { pid: 4, arrival: 4, burst: 2, priority: 2, deadline: 12 },
];
const algorithms = ['Adaptive', 'FCFS', 'SJF', 'Round Robin', 'Priority'];
const colors = ['#8b8cff', '#36c7b5', '#f4b860', '#f17d9c', '#70a8ff', '#b995ff'];

function App() {
  const [processes, setProcesses] = useState(demo);
  const [algorithm, setAlgorithm] = useState('Adaptive');
  const [quantum, setQuantum] = useState(3);
  const [nextPid, setNextPid] = useState(5);
  const [result, setResult] = useState(null);
  const [comparison, setComparison] = useState([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('Ready. Run a simulation to call the C++ engine.');
  const [apiReady, setApiReady] = useState(false);
  const [activeWorkspace, setActiveWorkspace] = useState('Overview');
  const [theme, setTheme] = useState('dark');
  const [playback, setPlayback] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [crashReport, setCrashReport] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState('');

  function navigateTo(name, targetId) {
    setActiveWorkspace(name);
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  useEffect(() => {
    if (!playback || !result?.timeline?.length) return;
    const id = window.setInterval(() => setPlayhead(v => {
      const end = Math.max(...result.timeline.map(seg => seg.end));
      if (v >= end) { setPlayback(false); return 0; }
      return Math.min(end, v + 1);
    }), 650);
    return () => window.clearInterval(id);
  }, [playback, result]);

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(d => setApiReady(Boolean(d.ok))).catch(() => setApiReady(false));
  }, []);

  const timelineEnd = result?.timeline?.length ? Math.max(...result.timeline.map(s => s.end)) : 1;
  const totalBusy = result?.timeline?.reduce((sum, s) => sum + (s.pid === null ? 0 : s.end - s.start), 0) ?? 0;
  const colorsByPid = useMemo(() => Object.fromEntries(processes.map((p, i) => [p.pid, colors[i % colors.length]])), [processes]);

  function change(pid, field, raw) {
    const value = raw === '' ? '' : Number(raw);
    setProcesses(old => old.map(p => p.pid === pid ? { ...p, [field]: value } : p));
  }
  function addProcess() {
    setProcesses(old => [...old, { pid: nextPid, arrival: 0, burst: 3, priority: 2, deadline: 15 }]);
    setNextPid(n => n + 1);
    setResult(null);
    setNotice(`Added P${nextPid}. Run the simulation to update the results.`);
  }
  function removeProcess(pid) {
    setProcesses(old => old.filter(p => p.pid !== pid));
    setResult(null);
  }
  function reset() {
    setProcesses(demo); setAlgorithm('Adaptive'); setQuantum(3); setNextPid(5);
    setResult(null); setComparison([]); setCrashReport(null); setPlayback(false); setPlayhead(0);
    setNotice('Demo workload restored. Run the simulation to calculate results.');
  }
  async function simulate(which = algorithm) {
    if (!processes.length) { setNotice('Add at least one process first.'); return null; }
    if (processes.some(p => !Number.isInteger(p.pid) || !Number.isInteger(p.arrival) || !Number.isInteger(p.burst) || !Number.isInteger(p.priority) || !Number.isInteger(p.deadline) || p.pid < 1 || p.arrival < 0 || p.burst < 1 || p.deadline < 0)) {
      setNotice('Check process values: arrival/deadline must be 0 or more, burst must be at least 1, and all values must be whole numbers.');
      return null;
    }
    if (new Set(processes.map(p => p.pid)).size !== processes.length) { setNotice('Process IDs must be unique.'); return null; }
    setBusy(true);
    try {
      const response = await fetch('/api/simulate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ processes, algorithm: which, quantum })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Simulation failed.');
      if (which === algorithm) { setResult(data); setPlayhead(0); setPlayback(false); }
      setNotice(`C++ engine completed ${which === 'Adaptive' ? `adaptive mode (${data.effectiveAlgorithm})` : which} simulation.`);
      return data;
    } catch (e) {
      setNotice(`${e.message} Check that the C++ engine is compiled and the API server is running.`);
      return null;
    } finally { setBusy(false); }
  }
  async function runComparison() {
    setBusy(true);
    const rows = [];
    for (const name of ['FCFS', 'SJF', 'Round Robin', 'Priority', 'Adaptive']) {
      const data = await simulate(name);
      if (!data) { setBusy(false); return; }
      rows.push({
        algorithm: name === 'Adaptive' ? `Adaptive (${data.effectiveAlgorithm})` : name,
        waiting: Number(data.overall.averageWaiting.toFixed(2)),
        turnaround: Number(data.overall.averageTurnaround.toFixed(2)),
        response: Number(data.overall.averageResponse.toFixed(2)),
        misses: data.overall.deadlineMisses
      });
    }
    setComparison(rows);
    setBusy(false);
    setNotice('Algorithm tournament complete. All policies used the same workload.');
  }
  function loadStressPreset(kind) {
    const presets = {
      'Short + long mix': [
        { pid: 1, arrival: 0, burst: 18, priority: 3, deadline: 30 },
        { pid: 2, arrival: 1, burst: 2, priority: 1, deadline: 6 },
        { pid: 3, arrival: 2, burst: 3, priority: 2, deadline: 9 },
        { pid: 4, arrival: 3, burst: 2, priority: 1, deadline: 10 },
        { pid: 5, arrival: 5, burst: 4, priority: 4, deadline: 17 },
      ],
      'Arrival burst': [
        { pid: 1, arrival: 0, burst: 5, priority: 2, deadline: 12 },
        { pid: 2, arrival: 5, burst: 6, priority: 1, deadline: 16 },
        { pid: 3, arrival: 5, burst: 2, priority: 3, deadline: 10 },
        { pid: 4, arrival: 6, burst: 3, priority: 2, deadline: 13 },
        { pid: 5, arrival: 6, burst: 1, priority: 1, deadline: 9 },
        { pid: 6, arrival: 7, burst: 2, priority: 4, deadline: 14 },
      ],
      'Priority pressure': [
        { pid: 1, arrival: 0, burst: 12, priority: 5, deadline: 20 },
        { pid: 2, arrival: 0, burst: 3, priority: 1, deadline: 6 },
        { pid: 3, arrival: 1, burst: 4, priority: 1, deadline: 8 },
        { pid: 4, arrival: 2, burst: 2, priority: 2, deadline: 7 },
        { pid: 5, arrival: 3, burst: 5, priority: 1, deadline: 12 },
      ]
    };
    const next = presets[kind];
    setProcesses(next); setNextPid(Math.max(...next.map(p => p.pid)) + 1);
    setSelectedPreset(kind);
    setNotice(`Selected ${kind}. The process list is updated; run the stress test to refresh its results. Existing results are kept until the new test finishes.`);
  }

  async function runCrashTest() {
    setBusy(true); setCrashReport(null);
    const report = [];
    try {
      for (const name of ['FCFS', 'SJF', 'Round Robin', 'Priority', 'Adaptive']) {
        const response = await fetch('/api/simulate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ processes, algorithm: name, quantum })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Stress test failed');
        const waits = data.metrics.map(m => m.waiting);
        const avg = waits.reduce((a,b) => a+b, 0) / Math.max(1, waits.length);
        const max = Math.max(0, ...waits);
        report.push({ algorithm: name === 'Adaptive' ? `Adaptive (${data.effectiveAlgorithm})` : name, waiting: data.overall.averageWaiting, response: data.overall.averageResponse, misses: data.overall.deadlineMisses, maxWait: max, unfair: avg > 0 && max > avg * 2 && max - avg >= 3 });
      }
      setCrashReport(report);
      setComparison(report.map(r => ({ algorithm: r.algorithm, waiting: Number(r.waiting.toFixed(2)), turnaround: 0, response: Number(r.response.toFixed(2)), misses: r.misses })));
      setNotice('Crash-test finished: every policy received the same workload. Review the measured trade-offs below.');
    } catch (e) { setNotice(`${e.message} Check the C++ API connection.`); }
    finally { setBusy(false); }
  }

  function exportCSV() {
    if (!result) { setNotice('Run a simulation before exporting results.'); return; }
    const rows = [
      ['PID', 'Arrival', 'Burst', 'Priority', 'Deadline', 'Start', 'Completion', 'Waiting', 'Turnaround', 'Response', 'DeadlineMiss'],
      ...result.metrics.map(m => {
        const p = processes.find(x => x.pid === m.pid);
        return [m.pid, p?.arrival, p?.burst, p?.priority, p?.deadline, m.start, m.completion, m.waiting, m.turnaround, m.response, m.deadlineMiss ? 'Yes' : 'No'];
      })
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = 'pulsesched-x-results.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const metrics = result?.overall;
  const chartData = comparison.map(r => ({ name: r.algorithm, 'Waiting time': r.waiting, 'Response time': r.response }));
  const fairness = result?.metrics?.length ? (() => { const waits = result.metrics.map(m => m.waiting); const avg = waits.reduce((a,b)=>a+b,0)/waits.length; const max = Math.max(...waits); const min = Math.min(...waits); const flagged = result.metrics.filter(m => avg > 0 && m.waiting > avg * 2 && m.waiting - avg >= 3); return { avg, max, min, spread: max-min, flagged }; })() : null;

  return <div className={`app-shell theme-${theme}`}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Activity size={23}/></div><div><div className="brand-name">PulseSched<span>-X</span></div><div className="brand-sub">SCHEDULING LAB</div></div></div>
      <div className="side-label">WORKSPACE</div>
      <button type="button" className={`side-item ${activeWorkspace === 'Overview' ? 'active' : ''}`} onClick={() => navigateTo('Overview', 'page-top')}><ChartNoAxesCombined size={17}/> Overview</button>
      <button type="button" className={`side-item ${activeWorkspace === 'Process manager' ? 'active' : ''}`} onClick={() => navigateTo('Process manager', 'process-manager')}><Cpu size={17}/> Process manager <span className="side-count">{processes.length}</span></button>
      <button type="button" className={`side-item ${activeWorkspace === 'Algorithm lab' ? 'active' : ''}`} onClick={() => navigateTo('Algorithm lab', 'algorithm-lab')}><GitCompareArrows size={17}/> Algorithm lab</button>
      <button type="button" className={`side-item ${activeWorkspace === 'Fairness & deadlines' ? 'active' : ''}`} onClick={() => navigateTo('Fairness & deadlines', 'fairness-auditor')}><ShieldCheck size={17}/> Fairness auditor</button>
      <button type="button" className={`side-item ${activeWorkspace === 'Crash-Test Lab' ? 'active' : ''}`} onClick={() => navigateTo('Crash-Test Lab', 'crash-test-lab')}><FlaskConical size={17}/> Crash-test lab</button>
      <div className="side-label side-label-spaced">ENGINE STATUS</div>
      <div className="engine-status"><span className={`status-dot ${apiReady ? '' : 'offline'}`}/>{apiReady ? 'C++ API connected' : 'API not connected'}</div>
      <div className="sidebar-bottom"><div className="sidebar-note">C++17 scheduling engine<br/>React + Vite dashboard</div><div className="sidebar-version">DEMO BUILD 0.1</div></div>
    </aside>

    <main className="main-content">
      <header className="topbar" id="page-top">
        <div><div className="eyebrow">OPERATING SYSTEMS PROJECT</div><h1>Scheduling overview</h1></div>
        <div className="top-actions"><div className={`live-pill ${apiReady ? '' : 'warning'}`}><span className={`status-dot ${apiReady ? '' : 'offline'}`}/>{apiReady ? 'Engine ready' : 'Engine offline'}</div><button className="icon-button theme-toggle" title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={17}/> : <Moon size={17}/>}</button><button className="icon-button" title="About PulseSched-X" onClick={() => setNotice('PulseSched-X is a CPU scheduling simulation. It does not modify the actual macOS scheduler.')}><CircleHelp size={18}/></button></div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <div className="hero-kicker"><BrainCircuit size={15}/> ADAPTIVE SCHEDULING ENGINE</div>
          <h2>Balance performance.<br/><span>Protect fairness.</span></h2>
          <p>Compare classic scheduling policies and inspect their impact on waiting time, responsiveness and deadlines.</p>
          <div className="hero-actions"><button className="primary-button" disabled={busy} onClick={() => simulate()}><Play size={16} fill="currentColor"/>{busy ? 'Running…' : 'Run simulation'}</button><button className="secondary-button" onClick={reset}><RotateCcw size={16}/> Reset demo</button></div>
          <div className="notice"><span className="notice-dot"/>{notice}</div>
        </div>
        <div className="hero-visual">
          <div className="orb orb-one"/><div className="orb orb-two"/>
          <div className="core-card">
            <div className="core-card-top"><span><Cpu size={16}/> SIMULATION MODEL</span><span className="core-live">4 CORE CONCEPT</span></div>
            <div className="core-grid">
              {[{name:'FCFS',pct:78},{name:'SJF',pct:62},{name:'ROUND ROBIN',pct:49},{name:'PRIORITY',pct:68}].map(c => <div className="core-tile" key={c.name}><span>{c.name}</span><strong>{c.pct}%</strong><div className="mini-track"><div style={{width:`${c.pct}%`}}/></div></div>)}
            </div>
            <div className="core-foot"><span><span className={`status-dot ${apiReady ? '' : 'offline'}`}/>{apiReady ? 'C++ engine connected' : 'Waiting for C++ API'}</span><span>SIMULATION ONLY</span></div>
          </div>
        </div>
      </section>

      <section className="stats-grid">
        <Stat icon={Gauge} label="AVG. WAITING TIME" value={metrics ? `${metrics.averageWaiting.toFixed(2)} units` : '—'} sub="Lower is generally better"/>
        <Stat icon={Activity} label="AVG. TURNAROUND" value={metrics ? `${metrics.averageTurnaround.toFixed(2)} units` : '—'} sub="Arrival to completion"/>
        <Stat icon={Zap} label="CPU UTILIZATION" value={metrics ? `${metrics.utilization.toFixed(1)}%` : '—'} sub="Busy time / elapsed time"/>
        <Stat icon={ShieldCheck} label="DEADLINE MISSES" value={metrics ? String(metrics.deadlineMisses) : '—'} sub="Completion after deadline"/>
      </section>

      <section className="content-grid">
        <div className="panel process-panel" id="process-manager">
          <div className="panel-heading"><div><div className="panel-kicker">INPUT</div><h3>Process manager</h3></div><button className="small-button" onClick={addProcess}><Plus size={15}/> Add process</button></div>
          <div className="table-wrap"><table><thead><tr><th>PROCESS</th><th>ARRIVAL</th><th>BURST</th><th>PRIORITY</th><th>DEADLINE</th><th></th></tr></thead>
            <tbody>{processes.map(p => <tr key={p.pid}><td><span className="process-id"><span style={{background: colorsByPid[p.pid]}}/>P{p.pid}</span></td>
              {['arrival', 'burst', 'priority', 'deadline'].map(field => <td key={field}><input aria-label={`P${p.pid} ${field}`} type="number" min={field === 'burst' ? 1 : 0} value={p[field]} onChange={e => change(p.pid, field, e.target.value)}/></td>)}
              <td><button className="delete-button" aria-label={`Remove P${p.pid}`} onClick={() => removeProcess(p.pid)}><Trash2 size={15}/></button></td></tr>)}</tbody>
          </table></div>
          <div className="panel-foot"><span>{processes.length} processes configured</span><span>Lower priority number = higher priority</span></div>
        </div>

        <div className="panel settings-panel">
          <div className="panel-heading"><div><div className="panel-kicker">CONFIGURATION</div><h3>Scheduling policy</h3></div><div className="settings-icon"><Cpu size={18}/></div></div>
          <label className="field-label" htmlFor="algorithm">ALGORITHM</label>
          <select id="algorithm" value={algorithm} onChange={e => { setAlgorithm(e.target.value); setResult(null); }} className="algorithm-select">
            {algorithms.map(a => <option key={a}>{a}</option>)}
          </select>
          {algorithm === 'Adaptive' && <div className="adaptive-note"><BrainCircuit size={17}/><div><strong>Rule-based adaptive mode</strong><p>Chooses a policy from workload burst patterns. This is a heuristic, not a trained AI model.</p></div></div>}
          <div className="quantum-row"><label className="field-label" htmlFor="quantum">ROUND ROBIN QUANTUM</label><span className="quantum-value">{quantum} units</span></div>
          <input id="quantum" className="quantum-slider" type="range" min="1" max="8" value={quantum} onChange={e => { setQuantum(Number(e.target.value)); setResult(null); }}/>
          <div className="range-labels"><span>1 unit · responsive</span><span>8 units · fewer switches</span></div>
          <button className="run-wide" disabled={busy} onClick={() => simulate()}><Play size={16} fill="currentColor"/> Run selected policy</button>
          <button className="export-wide" disabled={!result} onClick={exportCSV}><Download size={16}/> Export process metrics (CSV)</button>
        </div>
      </section>

      <section className="panel gantt-panel">
        <div className="panel-heading"><div><div className="panel-kicker">EXECUTION TRACE</div><h3>Gantt timeline</h3></div><div className="timeline-meta">{result ? `${result.effectiveAlgorithm} · ${timelineEnd} time units` : 'Run a simulation to generate the timeline'}</div></div>
        {result ? <><div className="playback-toolbar"><span className="playback-time">Time <strong>{playhead}</strong> / {timelineEnd}</span><div className="playback-actions"><button className="small-button" onClick={() => { setPlayback(false); setPlayhead(0); }}><RotateCcw size={14}/> Reset</button><button className="small-button" onClick={() => setPlayhead(v => Math.min(timelineEnd, v + 1))}><SkipForward size={14}/> Step</button><button className="small-button" onClick={() => { if (playhead >= timelineEnd) setPlayhead(0); setPlayback(v => !v); }}>{playback ? <Pause size={14}/> : <Play size={14}/>} {playback ? 'Pause' : 'Play'}</button></div></div><div className="gantt-track">{result.timeline.map((s, i) => { const active = playhead >= s.start && playhead < s.end; const passed = playhead >= s.end; return <div key={`${s.pid}-${s.start}-${i}`} className={`gantt-segment ${s.pid === null ? 'idle-segment' : ''} ${active ? 'segment-active' : ''} ${passed ? 'segment-passed' : ''}`} style={{flexGrow: Math.max(0.3, s.end - s.start), background: s.pid === null ? undefined : colorsByPid[s.pid] || colors[i % colors.length]}} title={`${s.pid === null ? 'CPU idle' : `P${s.pid}`}: ${s.start} to ${s.end}`}><strong>{s.pid === null ? 'IDLE' : `P${s.pid}`}</strong><small>{s.start}–{s.end}</small></div>; })}</div><div className="gantt-axis"><span>0</span><span>{(timelineEnd / 2).toFixed(1)}</span><span>{timelineEnd}</span></div><div className="gantt-legend">{processes.map(p => <span key={p.pid}><i style={{background: colorsByPid[p.pid]}}/>P{p.pid}</span>)}</div></> : <div className="empty-state"><div className="empty-icon"><ChartNoAxesCombined size={23}/></div><strong>Your timeline will appear here</strong><span>Choose a policy and run the simulation to see each process execution segment.</span></div>}
      </section>

      <section className="content-grid lower-grid">
        <div className="panel metrics-panel" id="fairness-deadlines"><div className="panel-heading"><div><div className="panel-kicker">RESULTS</div><h3>Per-process metrics</h3></div>{result && <span className="result-pill"><span className="status-dot"/> Calculated by C++</span>}</div>
          {result ? <div className="table-wrap"><table><thead><tr><th>PROCESS</th><th>START</th><th>FINISH</th><th>WAIT</th><th>TURNAROUND</th><th>RESPONSE</th><th>DEADLINE</th></tr></thead><tbody>{result.metrics.map(m => <tr key={m.pid}><td><span className="process-id"><span style={{background: colorsByPid[m.pid]}}/>P{m.pid}</span></td><td>{m.start}</td><td>{m.completion}</td><td>{m.waiting}</td><td>{m.turnaround}</td><td>{m.response}</td><td><span className={`deadline-tag ${m.deadlineMiss ? 'miss' : 'met'}`}>{m.deadlineMiss ? 'Missed' : 'Met'}</span></td></tr>)}</tbody></table></div> : <div className="compact-empty">Process metrics will appear after the first run.</div>}
        </div>
        <div className="panel compare-panel" id="algorithm-lab"><div className="panel-heading"><div><div className="panel-kicker">BENCHMARK</div><h3>Algorithm tournament</h3></div><button className="small-button" disabled={busy} onClick={runComparison}><GitCompareArrows size={15}/> Compare all</button></div>
          {comparison.length ? <><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{top:8,right:8,left:-18,bottom:28}}><CartesianGrid strokeDasharray="3 3" stroke="#293249"/><XAxis dataKey="name" angle={-15} textAnchor="end" interval={0} tick={{fill:'#a4adc5',fontSize:10}}/><YAxis tick={{fill:'#a4adc5',fontSize:10}}/><Tooltip contentStyle={{background:'#141b2d',border:'1px solid #303a54',borderRadius:10,color:'#fff'}}/><Legend wrapperStyle={{fontSize:11,color:'#b6bfd5'}}/><Bar dataKey="Waiting time" fill="#8b8cff" radius={[4,4,0,0]}/><Bar dataKey="Response time" fill="#36c7b5" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></div><div className="comparison-list">{comparison.map(r => <div key={r.algorithm}><span>{r.algorithm}</span><span>Wait {r.waiting} · Turnaround {r.turnaround} · Misses {r.misses}</span></div>)}</div></> : <div className="empty-state small-empty"><div className="empty-icon"><GitCompareArrows size={22}/></div><strong>Compare scheduling policies</strong><span>Run all four baselines and adaptive mode on the same workload.</span><button className="text-button" disabled={busy} onClick={runComparison}>Start comparison <span>→</span></button></div>}
        </div>
      </section>

      <section className="panel crash-panel" id="crash-test-lab">
        <div className="panel-heading"><div><div className="panel-kicker">ADVERSARIAL WORKLOADS</div><h3><FlaskConical size={17} style={{display:'inline',verticalAlign:'-3px',marginRight:7}}/>Scheduler Crash-Test Lab</h3></div><button className="small-button" disabled={busy} onClick={runCrashTest}><Play size={14}/> Run stress test</button></div>
        <p className="section-description">Load a repeatable challenge workload, then test every policy against the same process set. Results are measured by the C++ engine.</p>
        <div className="preset-row">{['Short + long mix','Arrival burst','Priority pressure'].map(name => <button key={name} aria-pressed={selectedPreset === name} className={`preset-button ${selectedPreset === name ? 'preset-selected' : ''}`} onClick={() => loadStressPreset(name)}>{selectedPreset === name ? '✓ ' : ''}{name}</button>)}</div>{selectedPreset && <div className="selected-preset-note"><strong>{selectedPreset}</strong> selected · Click <em>Run stress test</em> to calculate fresh results for this workload.</div>}
        {crashReport ? <div className="stress-results">{crashReport.map(r => <div className="stress-result" key={r.algorithm}><div><strong>{r.algorithm}</strong><span>{r.unfair ? 'Wait disparity flagged' : 'No disparity flag'}</span></div><div className="stress-metrics"><span>Avg wait <b>{r.waiting.toFixed(2)}</b></span><span>Max wait <b>{r.maxWait}</b></span><span>Misses <b>{r.misses}</b></span></div></div>)}</div> : <div className="lab-hint">Choose a workload preset, then run the stress test to generate evidence.</div>}
        <div className="lab-footnote">The disparity flag is a simple heuristic, not a formal starvation proof. This simulator does not change the actual macOS scheduler.</div>
      </section>

      <section className="panel fairness-panel" id="fairness-auditor">
        <div className="panel-heading"><div><div className="panel-kicker">PER-PROCESS EQUITY</div><h3><Scale size={17} style={{display:'inline',verticalAlign:'-3px',marginRight:7}}/>Fairness Auditor</h3></div>{fairness && <span className={`result-pill ${fairness.flagged.length ? 'fairness-warning' : ''}`}>{fairness.flagged.length ? 'Review waits' : 'No long-wait flag'}</span>}</div>
        {fairness ? <><div className="fairness-summary"><div><span>Average wait</span><strong>{fairness.avg.toFixed(2)}</strong></div><div><span>Longest wait</span><strong>{fairness.max}</strong></div><div><span>Wait spread</span><strong>{fairness.spread}</strong></div></div><p className="section-description">{fairness.flagged.length ? `Potentially disadvantaged: ${fairness.flagged.map(m=>`P${m.pid}`).join(', ')}. Their wait is more than twice the average and at least 3 units above it.` : 'No process crossed the current long-wait heuristic. This does not guarantee starvation is impossible.'}</p><div className="wait-bars">{result.metrics.map(m => <div className="wait-bar-row" key={m.pid}><span>P{m.pid}</span><div className="wait-bar-track"><div style={{width:`${fairness.max ? m.waiting/fairness.max*100 : 0}%`,background: fairness.flagged.some(f=>f.pid===m.pid) ? '#f17d9c' : colorsByPid[m.pid]}}/></div><b>{m.waiting}</b></div>)}</div></> : <div className="lab-hint">Run a simulation to inspect waiting-time disparity and potential long waits.</div>}
        <div className="lab-footnote">Fairness is evaluated from waiting times in this simulation. The heuristic flags suspicious disparity; it is not a formal starvation guarantee.</div>
      </section>

      <footer className="footer"><span>PulseSched-X · OS Scheduling Simulation</span><span><span className={`status-dot ${apiReady ? '' : 'offline'}`}/>{apiReady ? 'Connected to C++17 engine' : 'Start the API and compile the engine'}</span></footer>
    </main>
  </div>;
}

function Stat({ icon: Icon, label, value, sub }) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className="stat-icon"><Icon size={17}/></span></div><div className="stat-value">{value}</div><div className="stat-detail">{sub}</div></div>;
}
export default App;
