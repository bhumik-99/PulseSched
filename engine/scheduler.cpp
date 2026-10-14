#include <algorithm>
#include <cmath>
#include <iostream>
#include <iomanip>
#include <queue>
#include <set>
#include <sstream>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <vector>

struct Process {
    int pid, arrival, burst, priority;
};
struct Segment {
    int pid, start, end; // pid -1 means idle
};
struct Metric {
    int pid, start, completion, waiting, turnaround, response;
};

static std::string quote(const std::string& s) {
    std::string out = "\"";
    for (char c : s) {
        if (c == '"' || c == '\\') out += '\\';
        if (c == '\n') out += "\\n";
        else out += c;
    }
    return out + "\"";
}

static std::vector<Segment> fcfs(const std::vector<Process>& ps) {
    auto ordered = ps;
    std::stable_sort(ordered.begin(), ordered.end(), [](const Process& a, const Process& b) {
        return a.arrival < b.arrival || (a.arrival == b.arrival && a.pid < b.pid);
    });
    std::vector<Segment> out;
    int t = 0;
    for (const auto& p : ordered) {
        if (t < p.arrival) { out.push_back({-1, t, p.arrival}); t = p.arrival; }
        out.push_back({p.pid, t, t + p.burst});
        t += p.burst;
    }
    return out;
}

static std::vector<Segment> sjf(const std::vector<Process>& ps) {
    std::vector<Segment> out;
    std::set<int> done;
    int t = 0;
    while (done.size() < ps.size()) {
        const Process* pick = nullptr;
        for (const auto& p : ps) {
            if (done.count(p.pid) || p.arrival > t) continue;
            if (!pick || p.burst < pick->burst ||
                (p.burst == pick->burst && p.arrival < pick->arrival) ||
                (p.burst == pick->burst && p.arrival == pick->arrival && p.pid < pick->pid)) pick = &p;
        }
        if (!pick) {
            int next = 2147483647;
            for (const auto& p : ps) if (!done.count(p.pid)) next = std::min(next, p.arrival);
            if (next > t) { out.push_back({-1, t, next}); t = next; }
            continue;
        }
        out.push_back({pick->pid, t, t + pick->burst});
        t += pick->burst;
        done.insert(pick->pid);
    }
    return out;
}

static std::vector<Segment> prioritySchedule(const std::vector<Process>& ps) {
    std::vector<Segment> out;
    std::set<int> done;
    int t = 0;
    while (done.size() < ps.size()) {
        const Process* pick = nullptr;
        for (const auto& p : ps) {
            if (done.count(p.pid) || p.arrival > t) continue;
            // Lower numeric priority means higher priority.
            if (!pick || p.priority < pick->priority ||
                (p.priority == pick->priority && p.arrival < pick->arrival) ||
                (p.priority == pick->priority && p.arrival == pick->arrival && p.pid < pick->pid)) pick = &p;
        }
        if (!pick) {
            int next = 2147483647;
            for (const auto& p : ps) if (!done.count(p.pid)) next = std::min(next, p.arrival);
            if (next > t) { out.push_back({-1, t, next}); t = next; }
            continue;
        }
        out.push_back({pick->pid, t, t + pick->burst});
        t += pick->burst;
        done.insert(pick->pid);
    }
    return out;
}

static std::vector<Segment> roundRobin(const std::vector<Process>& ps, int quantum) {
    std::vector<Process> ordered = ps;
    std::stable_sort(ordered.begin(), ordered.end(), [](const Process& a, const Process& b) {
        return a.arrival < b.arrival || (a.arrival == b.arrival && a.pid < b.pid);
    });
    std::unordered_map<int, int> remaining;
    for (const auto& p : ps) remaining[p.pid] = p.burst;
    std::queue<int> ready;
    std::unordered_map<int, const Process*> byId;
    for (const auto& p : ps) byId[p.pid] = &p;
    std::vector<Segment> out;
    size_t next = 0;
    int t = 0;
    while (next < ordered.size() || !ready.empty()) {
        if (ready.empty() && next < ordered.size() && t < ordered[next].arrival) {
            out.push_back({-1, t, ordered[next].arrival});
            t = ordered[next].arrival;
        }
        while (next < ordered.size() && ordered[next].arrival <= t) ready.push(ordered[next++].pid);
        if (ready.empty()) continue;
        int id = ready.front(); ready.pop();
        int run = std::min(quantum, remaining[id]);
        out.push_back({id, t, t + run});
        t += run;
        remaining[id] -= run;
        while (next < ordered.size() && ordered[next].arrival <= t) ready.push(ordered[next++].pid);
        if (remaining[id] > 0) ready.push(id);
    }
    return out;
}

static std::vector<Metric> metrics(const std::vector<Process>& ps, const std::vector<Segment>& timeline) {
    std::unordered_map<int, Process> byId;
    std::unordered_map<int, int> first, finish;
    for (const auto& p : ps) byId[p.pid] = p;
    for (const auto& s : timeline) if (s.pid != -1) {
        if (!first.count(s.pid)) first[s.pid] = s.start;
        finish[s.pid] = s.end;
    }
    std::vector<Metric> result;
    for (const auto& p : ps) {
        int turnaround = finish.at(p.pid) - p.arrival;
        result.push_back({p.pid, first.at(p.pid), finish.at(p.pid),
                          turnaround - p.burst, turnaround, first.at(p.pid) - p.arrival});
    }
    std::sort(result.begin(), result.end(), [](const Metric& a, const Metric& b) { return a.pid < b.pid; });
    return result;
}

static void emit(const std::string& algorithm, const std::vector<Process>& ps,
                 const std::vector<Segment>& timeline, const std::string& note) {
    auto ms = metrics(ps, timeline);
    double w = 0, ta = 0, r = 0;
    int busy = 0, switches = 0, previous = -1;
    bool hasPrevious = false;
    for (const auto& m : ms) { w += m.waiting; ta += m.turnaround; r += m.response; }
    for (const auto& s : timeline) {
        if (s.pid != -1) {
            busy += s.end - s.start;
            if (hasPrevious && previous != s.pid) ++switches;
            previous = s.pid; hasPrevious = true;
        }
    }
    int elapsed = timeline.empty() ? 0 : timeline.back().end - timeline.front().start;
    double n = static_cast<double>(ps.size());
    std::cout << std::fixed << std::setprecision(2);
    std::cout << "{\"algorithm\":" << quote(algorithm) << ",\"note\":" << quote(note) << ",\"timeline\":[";
    for (size_t i = 0; i < timeline.size(); ++i) {
        if (i) std::cout << ",";
        const auto& s = timeline[i];
        std::cout << "{\"pid\":" << s.pid << ",\"start\":" << s.start << ",\"end\":" << s.end << "}";
    }
    std::cout << "],\"processMetrics\":[";
    for (size_t i = 0; i < ms.size(); ++i) {
        if (i) std::cout << ",";
        const auto& m = ms[i];
        std::cout << "{\"pid\":" << m.pid << ",\"start\":" << m.start << ",\"completion\":" << m.completion
                  << ",\"waiting\":" << m.waiting << ",\"turnaround\":" << m.turnaround
                  << ",\"response\":" << m.response << "}";
    }
    std::cout << "],\"summary\":{\"avgWaiting\":" << w/n << ",\"avgTurnaround\":" << ta/n
              << ",\"avgResponse\":" << r/n << ",\"cpuUtilization\":"
              << (elapsed > 0 ? 100.0 * busy / elapsed : 0.0)
              << ",\"throughput\":" << (elapsed > 0 ? n / elapsed : 0.0)
              << ",\"contextSwitches\":" << switches << ",\"elapsedTime\":" << elapsed << "}}\n";
}

int main() {
    try {
        std::string algorithm;
        int quantum, count;
        if (!(std::cin >> algorithm >> quantum >> count)) throw std::runtime_error("Missing input.");
        if (count < 1 || count > 100) throw std::runtime_error("Process count must be between 1 and 100.");
        std::vector<Process> ps;
        std::set<int> ids;
        for (int i = 0; i < count; ++i) {
            Process p{};
            if (!(std::cin >> p.pid >> p.arrival >> p.burst >> p.priority)) throw std::runtime_error("Invalid process input.");
            if (p.pid <= 0 || p.arrival < 0 || p.burst <= 0 || !ids.insert(p.pid).second)
                throw std::runtime_error("Invalid process values or duplicate IDs.");
            ps.push_back(p);
        }
        std::string actual = algorithm;
        std::string note = "Baseline scheduling policy.";
        std::vector<Segment> timeline;
        if (algorithm == "FCFS") timeline = fcfs(ps);
        else if (algorithm == "SJF") timeline = sjf(ps);
        else if (algorithm == "RR") timeline = roundRobin(ps, quantum);
        else if (algorithm == "PRIORITY") timeline = prioritySchedule(ps);
        else if (algorithm == "ADAPTIVE") {
            double avgBurst = 0;
            for (const auto& p : ps) avgBurst += p.burst;
            avgBurst /= ps.size();
            bool manyShort = avgBurst <= 4.0;
            bool arrivalsSpread = false;
            auto ordered = ps;
            std::sort(ordered.begin(), ordered.end(), [](const Process& a, const Process& b) { return a.arrival < b.arrival; });
            for (size_t i = 1; i < ordered.size(); ++i) if (ordered[i].arrival - ordered[i-1].arrival >= 3) arrivalsSpread = true;
            if (manyShort) {
                actual = "Round Robin";
                note = "Adaptive rule: average burst time is short, so Round Robin is selected to improve responsiveness.";
                timeline = roundRobin(ps, quantum);
            } else if (arrivalsSpread) {
                actual = "SJF";
                note = "Adaptive rule: workload has a spread of arrival times and longer jobs; non-preemptive SJF selected.";
                timeline = sjf(ps);
            } else {
                actual = "Priority";
                note = "Adaptive rule: mixed workload; Priority Scheduling selected. Lower numeric value means higher priority.";
                timeline = prioritySchedule(ps);
            }
        } else throw std::runtime_error("Unknown algorithm.");
        emit(actual, ps, timeline, note);
    } catch (const std::exception& e) {
        std::cerr << e.what() << "\n";
        return 1;
    }
}
