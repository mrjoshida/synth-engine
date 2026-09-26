export type FakeMIDIPortType = 'input' | 'output';
export type FakeMIDIPortDeviceState = 'connected' | 'disconnected';
export type FakeMIDIPortConnectionState = 'open' | 'closed' | 'pending';

export class FakeMIDIConnectionEvent extends Event {
  public readonly port?: FakeMIDIPort;

  constructor(type: string, port?: FakeMIDIPort) {
    super(type);
    this.port = port;
  }
}

export class FakeMIDIMessageEvent extends Event {
  public readonly data: Uint8Array;
  public override readonly timeStamp: number;

  constructor(data: Uint8Array, timeStamp: number) {
    super('midimessage');
    this.data = data;
    this.timeStamp = timeStamp;
  }
}

export interface FakeMIDIPortInit {
  id: string;
  name?: string;
  manufacturer?: string;
  type: FakeMIDIPortType;
  state?: FakeMIDIPortDeviceState;
  version?: string;
}

export class FakeMIDIPort extends EventTarget {
  public id: string;
  public manufacturer?: string;
  public name?: string;
  public type: FakeMIDIPortType;
  public version?: string;
  public state: FakeMIDIPortDeviceState = 'connected';
  public connection: FakeMIDIPortConnectionState = 'closed';
  public onstatechange: ((event: any) => void) | null = null;

  constructor(
    initOrId: FakeMIDIPortInit | string,
    type?: FakeMIDIPortType,
    name?: string,
    manufacturer?: string,
    state?: FakeMIDIPortDeviceState
  ) {
    super();
    if (typeof initOrId === 'string') {
      this.id = initOrId;
      this.type = type ?? 'input';
      this.name = name ?? initOrId;
      this.manufacturer = manufacturer;
      this.state = state ?? 'connected';
    } else {
      this.id = initOrId.id;
      this.name = initOrId.name ?? initOrId.id;
      this.manufacturer = initOrId.manufacturer;
      this.type = initOrId.type;
      this.state = initOrId.state ?? 'connected';
      this.version = initOrId.version;
    }
  }

  public async open(): Promise<FakeMIDIPort> {
    this.connection = 'open';
    return this;
  }

  public async close(): Promise<FakeMIDIPort> {
    this.connection = 'closed';
    return this;
  }

  public fireStateChange(): void {
    const ev = new FakeMIDIConnectionEvent('statechange', this);
    if (typeof this.onstatechange === 'function') {
      this.onstatechange(ev);
    }
    this.dispatchEvent(ev);
  }
}

export interface FakeMIDIInputInit {
  id: string;
  name?: string;
  manufacturer?: string;
  state?: FakeMIDIPortDeviceState;
}

export class FakeMIDIInput extends FakeMIDIPort {
  public onmidimessage: ((event: any) => void) | null = null;

  constructor(
    initOrId: FakeMIDIInputInit | string,
    name?: string,
    manufacturer?: string,
    state?: FakeMIDIPortDeviceState
  ) {
    if (typeof initOrId === 'string') {
      super(initOrId, 'input', name, manufacturer, state);
    } else {
      super({ ...initOrId, type: 'input' });
    }
  }

  public emit(data: number[] | Uint8Array, timeStamp?: number): void {
    const raw = data instanceof Uint8Array ? data : new Uint8Array(data);
    const ts = timeStamp ?? (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const event = new FakeMIDIMessageEvent(raw, ts);
    Object.defineProperty(event, 'target', { value: this, writable: false });

    if (typeof this.onmidimessage === 'function') {
      this.onmidimessage(event);
    }
    this.dispatchEvent(event);
  }
}

export interface SentMidiMessage {
  data: Uint8Array;
  timestamp?: number;
}

export interface FakeMIDIOutputInit {
  id: string;
  name?: string;
  manufacturer?: string;
  state?: FakeMIDIPortDeviceState;
}

export class FakeMIDIOutput extends FakeMIDIPort {
  public sentMessages: SentMidiMessage[] = [];

  constructor(
    initOrId: FakeMIDIOutputInit | string,
    name?: string,
    manufacturer?: string,
    state?: FakeMIDIPortDeviceState
  ) {
    if (typeof initOrId === 'string') {
      super(initOrId, 'output', name, manufacturer, state);
    } else {
      super({ ...initOrId, type: 'output' });
    }
  }

  public send(data: number[] | Uint8Array, timestamp?: number): void {
    const raw = data instanceof Uint8Array ? data : new Uint8Array(data);
    this.sentMessages.push({ data: raw, timestamp });
  }

  public clearSentMessages(): void {
    this.sentMessages = [];
  }
}

export class FakeMidiAccess extends EventTarget {
  public inputs: Map<string, FakeMIDIInput> = new Map();
  public outputs: Map<string, FakeMIDIOutput> = new Map();
  public sysexEnabled: boolean;
  public onstatechange: ((event: any) => void) | null = null;

  constructor(options?: {
    sysexEnabled?: boolean;
    inputs?: Array<FakeMIDIInput | (Partial<FakeMIDIInput> & { id: string })>;
    outputs?: Array<FakeMIDIOutput | (Partial<FakeMIDIOutput> & { id: string })>;
  }) {
    super();
    this.sysexEnabled = options?.sysexEnabled ?? false;
    if (options?.inputs) {
      for (const inp of options.inputs) {
        if (inp instanceof FakeMIDIInput) {
          this.inputs.set(inp.id, inp);
        } else {
          this.addInput(inp);
        }
      }
    }
    if (options?.outputs) {
      for (const out of options.outputs) {
        if (out instanceof FakeMIDIOutput) {
          this.outputs.set(out.id, out);
        } else {
          this.addOutput(out);
        }
      }
    }
  }

  public addInput(port: Partial<FakeMIDIInput> & { id: string }): FakeMIDIInput {
    const input = port instanceof FakeMIDIInput
      ? port
      : new FakeMIDIInput({
          id: port.id,
          name: port.name ?? port.id,
          manufacturer: port.manufacturer,
          state: port.state ?? 'connected'
        });
    this.inputs.set(port.id, input);
    this.fireStateChange(input);
    return input;
  }

  public addOutput(port: Partial<FakeMIDIOutput> & { id: string }): FakeMIDIOutput {
    const output = port instanceof FakeMIDIOutput
      ? port
      : new FakeMIDIOutput({
          id: port.id,
          name: port.name ?? port.id,
          manufacturer: port.manufacturer,
          state: port.state ?? 'connected'
        });
    this.outputs.set(port.id, output);
    this.fireStateChange(output);
    return output;
  }

  public removeInput(id: string): boolean {
    const port = this.inputs.get(id);
    if (!port) return false;
    port.state = 'disconnected';
    this.inputs.delete(id);
    this.fireStateChange(port);
    return true;
  }

  public removeOutput(id: string): boolean {
    const port = this.outputs.get(id);
    if (!port) return false;
    port.state = 'disconnected';
    this.outputs.delete(id);
    this.fireStateChange(port);
    return true;
  }

  public connectPort(portOrId: string | FakeMIDIPort): void {
    if (typeof portOrId === 'string') {
      const port = this.inputs.get(portOrId) || this.outputs.get(portOrId);
      if (port) {
        port.state = 'connected';
        port.fireStateChange();
        this.fireStateChange(port);
      }
    } else {
      portOrId.state = 'connected';
      if (portOrId.type === 'input') {
        this.inputs.set(portOrId.id, portOrId as FakeMIDIInput);
      } else {
        this.outputs.set(portOrId.id, portOrId as FakeMIDIOutput);
      }
      portOrId.fireStateChange();
      this.fireStateChange(portOrId);
    }
  }

  public disconnectPort(portOrId: string | FakeMIDIPort): void {
    const id = typeof portOrId === 'string' ? portOrId : portOrId.id;
    const port = this.inputs.get(id) || this.outputs.get(id) || (typeof portOrId === 'object' ? portOrId : undefined);
    if (port) {
      port.state = 'disconnected';
      port.fireStateChange();
      this.fireStateChange(port);
    }
  }

  public fireStateChange(port?: FakeMIDIPort): void {
    const event = new FakeMIDIConnectionEvent('statechange', port);
    if (typeof this.onstatechange === 'function') {
      this.onstatechange(event);
    }
    this.dispatchEvent(event);
  }
}

export interface InstallFakeMidiOptions {
  access?: FakeMidiAccess;
  sysexAllowed?: boolean;
  denySysex?: boolean;
  initialInputs?: Array<Partial<FakeMIDIInput> & { id: string }>;
  initialOutputs?: Array<Partial<FakeMIDIOutput> & { id: string }>;
}

export function installFakeMidi(
  targetOrOptions?: any,
  maybeOptions?: InstallFakeMidiOptions
): { access: FakeMidiAccess; restore: () => void } {
  let target: any;
  let options: InstallFakeMidiOptions | undefined;

  if (targetOrOptions && (targetOrOptions.navigator !== undefined || targetOrOptions === globalThis || (typeof window !== 'undefined' && targetOrOptions === window))) {
    target = targetOrOptions;
    options = maybeOptions;
  } else {
    target = typeof window !== 'undefined' ? window : globalThis;
    options = targetOrOptions as InstallFakeMidiOptions;
  }

  if (!target.navigator) {
    target.navigator = {};
  }

  const originalRequest = target.navigator.requestMIDIAccess;
  const access = options?.access ?? new FakeMidiAccess({ sysexEnabled: false });

  if (options?.initialInputs) {
    for (const inp of options.initialInputs) {
      access.addInput(inp);
    }
  }
  if (options?.initialOutputs) {
    for (const out of options.initialOutputs) {
      access.addOutput(out);
    }
  }

  target.navigator.requestMIDIAccess = async (reqOpts?: { sysex?: boolean }) => {
    const wantSysex = reqOpts?.sysex ?? false;
    const sysexAllowed = options?.denySysex === true ? false : (options?.sysexAllowed ?? true);

    if (wantSysex && !sysexAllowed) {
      const err = new Error('SecurityError: Insufficient privileges to access SysEx');
      err.name = 'SecurityError';
      throw err;
    }

    access.sysexEnabled = wantSysex && sysexAllowed;
    return access as unknown as MIDIAccess;
  };

  const restore = () => {
    if (originalRequest !== undefined) {
      target.navigator.requestMIDIAccess = originalRequest;
    } else {
      delete target.navigator.requestMIDIAccess;
    }
  };

  return { access, restore };
}
