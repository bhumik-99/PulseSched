#include <algorithm>
#include <cmath>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

struct Process {
    int pid, arrival, burst, priority, deadline;
};
struct Segment { int pid, start, end; }; // pid=-1 means idle
struct Metric {
    int pid, start, completion, waiting, turnaround, response;
    bool deadlineMiss;
};

static std::vector<Process> parseProcesses(const std::string& input) {
    std::vector<Process> ps;
    std::stringstream all(input);
    std::string row;
    std::unordered_set<int> ids;
    while (std::getline(all, row, ';')) {
        std::stringstream line(row);
        std::string field;
        std::vector<int> v;
        while (std::getline(line, field, ',')) v.push_back(std::stoi(field));
        if (v.size() != 5) throw std::invalid_argument("Invalid process record.");
        Process p{v[0], v[1], v[2], v[3], v[4]};
        if (p.pid <= 0 || p.arrival < 0 || p.burst <= 0 || p.deadline < 0)
            throw std::invalid_argument("Invalid process values.");
        if (!ids.insert(p.pid).second) throw std::invalid_argument("Duplicate process IDs.");
        ps.push_back(p);
    }
    if (ps.empty()) throw std::invalid_argument("No processes supplied.");
    return ps;
}

static std::string chooseAdaptive(const std::vector<Process>& ps, std::string& reason) {
    double avg = 0;
    int minBurst = ps.front().burst, maxBurst = ps.front().burst;
    for (const auto& p : ps) {
        avg += p.burst;
        minBurst = std::min(minBurst, p.burst);
        maxBurst = std::max(maxBurst, p.burst);
    }
    avg /= ps.size();
    if (ps.size() >= 5 && avg <= 4.0) {
        reason = "Many short jobs detected; Round Robin is selected for responsiveness.";
        return "Round Robin";
    }
    if (maxBurst - minBurst >= 6) {
        reason = "Burst times vary widely; SJF is selected to favor short available jobs.";
        return "SJF";
    }
    reason = "Workload has moderate burst variation; Priority is selected as the rule-based policy.";
    return "Priority";
}

static std::vector<Segment> runSchedule(const std::vector<Process>& ps,
                                         const std::string& alg, int quantum) {
    std::vector<Process> order = ps;
    std::stable_sort(order.begin(), order.end(), [](const Process& a, const Process& b) {
        if (a.arrival != b.arrival) return a.arrival < b.arrival;
        return a.pid < b.pid;
    });
    std::vector<Segment> timeline;
    int now = 0;
    if (alg == "FCFS") {
        for (const auto& p : order) {
            if (now < p.arrival) { timeline.push_back({-1, now, p.arrival}); now = p.arrival; }
            timeline.push_back({p.pid, now, now + p.burst});
            now += p.burst;
        }
        return timeline;
    }
    if (alg == "SJF" || alg == "Priority") {
        std::vector<bool> done(order.size(), false);
        size_t finished = 0;
        while (finished < order.size()) {
            int chosen = -1;
            for (size_t i = 0; i < order.size(); ++i) {
                if (done[i] || order[i].arrival > now) continue;
                if (chosen == -1) chosen = static_cast<int>(i);
                else if (alg == "SJF") {
                    if (order[i].burst < order[chosen].burst ||
                        (order[i].burst == order[chosen].burst && order[i].arrival < order[chosen].arrival))
                        chosen = static_cast<int>(i);
                } else {
                    if (order[i].priority < order[chosen].priority ||
                        (order[i].priority == order[chosen].priority && order[i].arrival < order[chosen].arrival))
                        chosen = static_cast<int>(i);
                }
            }
            if (chosen == -1) {
                int nextArrival = -1;
                for (size_t i = 0; i < order.size(); ++i)
                    if (!done[i] && (nextArrival == -1 || order[i].arrival < nextArrival))
                        nextArrival = order[i].arrival;
                timeline.push_back({-1, now, nextArrival});
                now = nextArrival;
                continue;
            }
            const auto& p = order[chosen];
            timeline.push_back({p.pid, now, now + p.burst});
            now += p.burst;
            done[chosen] = true;
            ++finished;
        }
        return timeline;
    }
    if (alg == "Round Robin") {
        std::vector<int> remaining(order.size());
        for (size_t i = 0; i < order.size(); ++i) remaining[i] = order[i].burst;
        std::vector<size_t> ready;
        size_t next = 0;
        while (next < order.size() || !ready.empty()) {
            if (ready.empty() && next < order.size() && now < order[next].arrival) {
                timeline.push_back({-1, now, order[next].arrival});
                now = order[next].arrival;
            }
            while (next < order.size() && order[next].arrival <= now) ready.push_back(next++);
            if (ready.empty()) continue;
            size_t i = ready.front();
            ready.erase(ready.begin());
            int run = std::min(quantum, remaining[i]);
            timeline.push_back({order[i].pid, now, now + run});
            now += run;
            remaining[i] -= run;
            while (next < order.size() && order[next].arrival <= now) ready.push_back(next++);
            if (remaining[i] > 0) ready.push_back(i);
        }
        return timeline;
    }
    throw std::invalid_argument("Unknown scheduling algorithm.");
}

int main(int argc, char** argv) {
    try {
        if (argc != 4) throw std::invalid_argument("Usage: engine <algorithm> <quantum> <processes>");
        std::string requested = argv[1];
        int quantum = std::stoi(argv[2]);
        if (quantum < 1) throw std::invalid_argument("Quantum must be positive.");
        auto ps = parseProcesses(argv[3]);
        std::string alg = requested, reason;
        if (requested == "Adaptive") alg = chooseAdaptive(ps, reason);
        if (requested == "Adaptive") std::cout << "A," << alg << "," << reason << "\n";
        auto timeline = runSchedule(ps, alg, quantum);

        std::unordered_map<int, Process> byId;
        for (const auto& p : ps) byId[p.pid] = p;
        std::unordered_map<int, int> first, completion;
        int busy = 0, switches = 0, previous = -1;
        bool havePrevious = false;
        for (const auto& s : timeline) {
            if (s.pid == -1) continue;
            busy += s.end - s.start;
            if (first.find(s.pid) == first.end()) first[s.pid] = s.start;
            completion[s.pid] = s.end;
            if (havePrevious && previous != s.pid) ++switches;
            previous = s.pid; havePrevious = true;
        }

        double sumW = 0, sumT = 0, sumR = 0;
        int misses = 0;
        std::vector<Metric> metrics;
        for (const auto& p : ps) {
            int start = first.at(p.pid);
            int finish = completion.at(p.pid);
            int turnaround = finish - p.arrival;
            int waiting = turnaround - p.burst;
            int response = start - p.arrival;
            bool miss = finish > p.deadline;
            if (miss) ++misses;
            metrics.push_back({p.pid, start, finish, waiting, turnaround, response, miss});
            sumW += waiting; sumT += turnaround; sumR += response;
        }
        std::sort(metrics.begin(), metrics.end(), [](const Metric& a, const Metric& b) { return a.pid < b.pid; });
        int startTime = timeline.empty() ? 0 : timeline.front().start;
        int endTime = timeline.empty() ? 0 : timeline.back().end;
        int elapsed = endTime - startTime;
        double n = static_cast<double>(ps.size());
        std::cout << std::fixed << std::setprecision(3);
        for (const auto& s : timeline) std::cout << "E," << s.pid << "," << s.start << "," << s.end << "\n";
        for (const auto& m : metrics)
            std::cout << "M," << m.pid << "," << m.start << "," << m.completion << ","
                      << m.waiting << "," << m.turnaround << "," << m.response << ","
                      << (m.deadlineMiss ? 1 : 0) << "\n";
        std::cout << "O," << sumW/n << "," << sumT/n << "," << sumR/n << ","
                  << (elapsed > 0 ? 100.0 * busy / elapsed : 0.0) << ","
                  << (elapsed > 0 ? n / elapsed : 0.0) << "," << switches << ","
                  << elapsed << "," << misses << "\n";
    } catch (const std::exception& e) {
        std::cerr << e.what() << "\n";
        return 1;
    }
    return 0;
}
