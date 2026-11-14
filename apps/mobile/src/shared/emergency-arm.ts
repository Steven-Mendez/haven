// One-shot «already confirmed» flag for the next 'emergency:open' (M00 ↔ M06).
// The header SOS button sets it after a completed 3 s hold, so the emergency screen opens straight
// on the protocol instead of asking for the hold again. A short tap does not set it (the
// emergency screen then shows its own hold-to-confirm ring).

let armed = false;

/** Marks the next emergency as confirmed (call right before emitting 'emergency:open'). */
export function armNextEmergency() {
  armed = true;
}

/** Reads and clears the flag. */
export function takeArmedEmergency(): boolean {
  const value = armed;
  armed = false;
  return value;
}
