let armed = false;

export function armNextEmergency() {
  armed = true;
}

export function takeArmedEmergency(): boolean {
  const value = armed;
  armed = false;
  return value;
}
