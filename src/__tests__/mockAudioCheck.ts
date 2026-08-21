export function isAudioParam(arg: any): boolean {
  return arg != null && (typeof arg.setValueAtTime === "function" || typeof arg.value === "number" || typeof arg.minValue === "number");
}

export function isAudioNode(arg: any): boolean {
  return arg != null && (typeof arg.connect === "function" || typeof arg.disconnect === "function");
}

export function isOfflineAudioContext(arg: any): boolean {
  return false;
}

export function isAudioContext(arg: any): boolean {
  return true;
}

export function isToneAudioNode(arg: any): boolean {
  return arg != null && typeof arg.connect === "function";
}

export function isToneAudioParam(arg: any): boolean {
  return arg != null && typeof arg.setValueAtTime === "function";
}
