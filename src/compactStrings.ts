let wasmModule: WebAssembly.WebAssemblyInstantiatedSource;

export const initWasm = async () => {
  if (wasmModule) {
    return;
  }

  const response = await fetch("strings.c.wasm");
  const buffer = await response.arrayBuffer();
  wasmModule = await WebAssembly.instantiate(new Uint8Array(buffer));
};

/*
        WORKSPACE

        0 end
        4 free
        8

      */

const END = 0;
const FREE = 4;
const USER = 8;

const align = (p) => 4 * (((p + 3) / 4) | 0);

const interop = ({ instance, method, workMemory, writeback }, ...args) => {
  const {
    exports: { memory },
  } = instance;

  let required = workMemory;
  for (const arg of args) {
    if (typeof arg === "object" && "byteLength" in arg) {
      required += align(arg.byteLength);
    }
  }

  // get current size
  const extra = Math.ceil((required - memory.buffer.byteLength) / (256 * 256));
  if (extra > 0) {
    memory.grow(extra);
  }
  const workspace = new Uint32Array(memory.buffer, 0, USER / 4);
  workspace[END / 4] = memory.buffer.byteLength;

  const bytes = new Uint8Array(memory.buffer, 0, memory.buffer.byteLength);

  const raw = [];
  let p = USER;
  for (const arg of args) {
    if (typeof arg === "object" && "byteLength" in arg) {
      raw.push(p);
      const t = new Uint8Array(arg.buffer, arg.byteOffset, arg.byteLength);
      for (let i = 0; i < arg.byteLength; i++) {
        bytes[p + i] = t[i];
      }

      p += align(arg.byteLength);
    } else {
      raw.push(arg);
    }
  }

  workspace[FREE / 4] = p;

  const result = instance.exports[method](...raw);

  // writeback
  p = USER;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (typeof arg === "object" && "byteLength" in arg) {
      if (writeback.has(i)) {
        const t = new Uint8Array(arg.buffer, arg.byteOffset, arg.byteLength);
        for (let i = 0; i < arg.byteLength; i++) {
          t[i] = bytes[p + i];
        }
      }

      p += align(arg.byteLength);
    }
  }

  return result;
};

const compactJS = (instance, target, offsets, count, source) => {
  const SIZE = 65536;

  return interop(
    {
      instance,
      method: "compact",
      workMemory: 4 * SIZE,
      writeback: new Set([0, 1]),
    },
    target,
    offsets,
    count,
    source
  );
};

export const compact = () => {
  const dataX = ["Hello", "World", "Hello", "World", "Hello"];
  const data = new Array(1e5)
    .fill(0)
    .map(() => Math.random().toString(16).substring(11));

  const strings = new Uint32Array(data.length);
  const source = new Uint8Array(6 * data.length);

  const encoder = new TextEncoder();
  let p = 0;
  for (let i = 0; i < data.length; i += 1) {
    const value = data[i];
    strings[i] = p;

    const r = encoder.encodeInto(
      value,
      new Uint8Array(source.buffer, p, source.byteLength - p)
    );
    source[p + r.written] = 0xff;
    p += r.written + 1;
  }

  const s = performance.now();
  const target = new Uint8Array(source.byteLength);
  const targetLen = compactJS(
    wasmModule.instance,
    target,
    strings,
    data.length,
    source
  );
  console.log("Time taken: ", performance.now() - s);
  console.log(`Size: ${p} -> ${targetLen}`);

  for (let i = 0; i < Math.min(16, data.length); i += 1) {
    const p = strings[i];

    // get string length
    let n = 0;
    while (target[p + n] !== 0xff) n += 1;

    console.log(new TextDecoder().decode(new Uint8Array(target.buffer, p, n)));
  }
};

export default "hello";
