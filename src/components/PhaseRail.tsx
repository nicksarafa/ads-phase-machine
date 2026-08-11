"use client";

import { PHASES, PHASE_LABELS, type MachineState } from "@/lib/types";

export default function PhaseRail({ machine }: { machine: MachineState }) {
  const currentIdx = PHASES.indexOf(machine.phase as (typeof PHASES)[number]);

  return (
    <div className="rail">
      {PHASES.map((p, i) => {
        const active = machine.phase === p;
        const done = currentIdx > i && machine.phase !== "idle";
        return (
          <div
            key={p}
            className={`phase ${active ? "active" : ""} ${done ? "done" : ""}`}
          >
            <div className="phase-idx">
              {String(i + 1).padStart(2, "0")}
              {done ? " ✓" : ""}
            </div>
            <div className="phase-name">{PHASE_LABELS[p]}</div>
            {active && (
              <div
                className="phase-bar"
                style={{ width: `${Math.round(machine.phaseProgress * 100)}%` }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
