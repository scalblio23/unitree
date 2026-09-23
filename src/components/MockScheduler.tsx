"use client";

import { useState } from "react";

/**
 * Stand-in for the live booking calendar. It is deliberately inert: no network
 * calls, no third-party widget, and the copy makes clear that nothing is
 * actually booked.
 */

const SLOTS = [
  { id: "mon-am", day: "Monday", time: "9:30 am" },
  { id: "mon-pm", day: "Monday", time: "2:00 pm" },
  { id: "tue-am", day: "Tuesday", time: "10:15 am" },
  { id: "tue-pm", day: "Tuesday", time: "3:45 pm" },
  { id: "wed-am", day: "Wednesday", time: "11:00 am" },
  { id: "wed-pm", day: "Wednesday", time: "4:30 pm" },
];

export function MockScheduler() {
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const chosen = SLOTS.find((slot) => slot.id === selected);

  return (
    <div className="scheduler">
      <p className="scheduler-note">
        Demo scheduler — this is a placeholder for the live booking calendar. No appointment is
        made and nothing is sent anywhere.
      </p>

      <p className="scheduler-label" id="slot-label">
        Pick a time
      </p>
      <div className="slot-grid" role="group" aria-labelledby="slot-label">
        {SLOTS.map((slot) => (
          <button
            key={slot.id}
            type="button"
            className="slot"
            aria-pressed={selected === slot.id}
            onClick={() => {
              setSelected(slot.id);
              setConfirmed(false);
            }}
          >
            {slot.time}
            <small>{slot.day}</small>
          </button>
        ))}
      </div>

      <button
        className="primary"
        type="button"
        disabled={!selected}
        onClick={() => setConfirmed(true)}
      >
        Confirm time
      </button>

      <p className="scheduler-result" role="status">
        {confirmed && chosen
          ? `Demo only — ${chosen.day} at ${chosen.time} was not booked. A live build would hand off to a real calendar here.`
          : ""}
      </p>
    </div>
  );
}
