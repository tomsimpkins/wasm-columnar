import { decodeDate, encodeDate } from "./dateUtils";
import { utf8DecodeJs, utf8EncodeJs } from "./stringUtils";
import { PropertyValue, PropertyValueType } from "./types";

// Column must give access by index
// Must give reified column quickly
// Must have fast serializable representation

const separator = String.fromCodePoint(0xff);

const createColumnBytes = (length: number): ColumnBytes => {
  return {
    stringBuffer: new Uint8Array(length * 50),
    buffer: new ArrayBuffer(length + 4 * length + 8 * length), // types + offsets + values
    stringCount: 0,
    byteOffset: 0,
    stringOffset: 0,
    length,
  };
};

type ColumnBytes = {
  stringBuffer: ArrayBuffer;
  buffer: ArrayBuffer;

  byteOffset: number;
  stringOffset: number;
  stringCount: number;

  length: number;
};

export class ByteColumn {
  static fromColumnBytes(columnBytes: ColumnBytes): ByteColumn {
    return new ByteColumn(columnBytes);
  }

  toColumnBytes(): ColumnBytes {
    return {
      stringBuffer: this.stringEncoded.buffer.slice(0),
      buffer: this.buffer.slice(0),

      stringCount: this.stringCount,
      byteOffset: this.valueByteOffset,
      stringOffset: this.stringByteOffset,
      length: this.length,
    };
  }

  static fromArray(values: PropertyValue[]): ByteColumn {
    const column = new ByteColumn(createColumnBytes(values.length));
    for (let i = 0; i < values.length; i++) {
      column.setValue(i, values[i]);
    }

    return column;
  }

  toArray() {
    const res: PropertyValue[] = new Array(this.length);
    for (let i = 0; i < this.length; i++) {
      res[i] = this.getValue(i);
    }

    return res;
  }

  reify(): PropertyValue[] {
    const { reified, length } = this;
    for (let i = 0; i < length; i++) {
      reified[i] = this.getValue(i);
    }

    return reified;
  }

  reifyValue(index: number): PropertyValue {
    return index in this.reified
      ? this.reified[index]
      : (this.reified[index] = this.getValue(index));
  }

  *[Symbol.iterator]() {
    for (let i = 0; i < this.length; i++) {
      yield this.getValue(i);
    }
  }

  protected valueByteOffset: number;
  protected stringByteOffset: number;
  protected length: number;

  protected buffer: ArrayBuffer;
  protected valueView: DataView;
  protected typesView: DataView;
  protected offsetsView: DataView;

  protected stringEncoded: Uint8Array;
  protected stringsView: DataView;
  protected stringCount: number;

  protected reified: PropertyValue[];

  constructor(initialState: ColumnBytes) {
    this.valueByteOffset = initialState.byteOffset;
    this.stringByteOffset = initialState.stringOffset;
    this.stringCount = initialState.stringCount;
    this.length = initialState.length;

    this.stringEncoded = new Uint8Array(initialState.stringBuffer);
    this.stringsView = new DataView(this.stringEncoded.buffer);
    this.buffer = initialState.buffer;

    this.typesView = new DataView(this.buffer, 0, initialState.length);
    this.offsetsView = new DataView(
      this.buffer,
      initialState.length,
      initialState.length * 4
    );
    this.valueView = new DataView(this.buffer, initialState.length * 5);

    this.reified = new Array(initialState.length);
  }

  static getValueType = (value: PropertyValue): PropertyValueType => {
    const type = typeof value;

    if (type === "object") {
      if (value instanceof Date) {
        return PropertyValueType.Date;
      }

      throw new Error(`unknown value type for ${value}`);
    }

    switch (type) {
      case "boolean":
        return PropertyValueType.Boolean;
      case "string":
        return PropertyValueType.String;
      case "number":
        return PropertyValueType.Number;
      case "undefined":
        return PropertyValueType.Undefined;
    }

    throw new Error(`unknown value type for ${value}`);
  };

  getValue(index: number): PropertyValue {
    const type = this.typesView.getUint8(index) as PropertyValueType;

    switch (type) {
      case PropertyValueType.String: {
        return this.getString(index);
      }
      case PropertyValueType.Boolean: {
        return this.getBoolean(index);
      }
      case PropertyValueType.Date: {
        return this.getDate(index);
      }
      case PropertyValueType.Number: {
        return this.getNumber(index);
      }
      case PropertyValueType.Undefined: {
        return undefined;
      }
    }
  }

  setValue(index: number, value: PropertyValue) {
    const i = index | 0;
    const safeType = ByteColumn.getValueType(value) | 0;

    switch (safeType) {
      case PropertyValueType.String: {
        this.setString(i, value as string);
        break;
      }
      case PropertyValueType.Number: {
        this.setNumber(i, value as number);
        break;
      }
      case PropertyValueType.Date: {
        this.setDate(i, value as Date);
        break;
      }
      case PropertyValueType.Boolean: {
        this.setBoolean(i, value as boolean);
        break;
      }
      case PropertyValueType.Undefined: {
        this.setUndefined(i);
        break;
      }
    }
  }

  setUndefined(index: number) {
    this.typesView.setUint8(index, PropertyValueType.Undefined);
  }

  // byte offsets encoding
  setString(index: number, value: string) {
    const {
      stringEncoded,
      stringByteOffset: start,
      valueByteOffset: byteStart,
      offsetsView,
      valueView,
      typesView,
      stringsView,
    } = this;

    const bytesWritten = utf8EncodeJs(value, stringEncoded, start + 4);
    // const bytesWritten = 0;
    stringsView.setUint32(start, bytesWritten);

    valueView.setUint32(byteStart, start);
    offsetsView.setUint32(index * 4, byteStart);

    this.valueByteOffset += 4;
    this.stringByteOffset += bytesWritten + 4;

    typesView.setUint8(index, PropertyValueType.String);
  }

  getString(index: number): string {
    const { stringsView, stringEncoded, valueView: view, offsetsView } = this;
    const start = view.getUint32(offsetsView.getUint32(index * 4));
    const byteLength = stringsView.getUint32(start);

    return utf8DecodeJs(
      stringEncoded,
      start + 4,
      byteLength >= 0 ? byteLength : 0
    );
  }
  setNumber(index: number, value: number) {
    const {
      typesView,
      valueView,
      offsetsView,
      valueByteOffset: offsetStart,
    } = this;

    valueView.setFloat64(offsetStart, value);
    offsetsView.setUint32(index * 4, offsetStart);
    this.valueByteOffset += 8;

    typesView.setUint8(index, PropertyValueType.Number);
  }

  getNumber(index: number): number {
    return this.valueView.getFloat64(this.offsetsView.getUint32(index * 4));
  }

  setDate(index: number, value: Date) {
    const {
      valueView,
      offsetsView,
      valueByteOffset: startOffset,
      typesView,
    } = this;

    valueView.setUint32(startOffset, encodeDate(value));
    offsetsView.setUint32(index * 4, startOffset);
    this.valueByteOffset += 4;

    typesView.setUint8(index, PropertyValueType.Date);
  }

  getDate(index: number) {
    const v = this.valueView.getUint32(this.offsetsView.getUint32(index * 4));

    return decodeDate(v);
  }

  setBoolean(index: number, value: boolean) {
    const {
      valueByteOffset: startOffset,
      valueView,
      offsetsView,
      typesView,
    } = this;

    const v = value ? 1 : 0;
    valueView.setUint8(startOffset, v);
    offsetsView.setUint32(index * 4, startOffset);
    this.valueByteOffset += 1;

    typesView.setUint8(index, PropertyValueType.Boolean);
  }

  getBoolean(index: number): boolean {
    return this.valueView.getUint8(this.offsetsView.getUint32(index * 4)) > 0;
  }
}

export class DictionaryByteColumn extends ByteColumn {
  static fromColumnBytes(columnBytes: ColumnBytes): DictionaryByteColumn {
    return new DictionaryByteColumn(columnBytes);
  }

  static fromArray(values: PropertyValue[]): DictionaryByteColumn {
    const column = new DictionaryByteColumn(createColumnBytes(values.length));
    for (let i = 0; i < values.length; i++) {
      column.setValue(i, values[i]);
    }

    return column;
  }
  dictionary: Record<string, number> = {};
  decodeCache: string[] = [];

  getString(index: number): string {
    const {
      decodeCache,
      stringsView,
      stringEncoded,
      valueView: view,
      offsetsView,
    } = this;

    const start = view.getUint32(offsetsView.getUint32(index * 4));
    if (decodeCache[start] !== undefined) {
      return decodeCache[start];
    }

    const byteLength = stringsView.getUint32(start);
    return (decodeCache[start] = utf8DecodeJs(
      stringEncoded,
      start + 4,
      byteLength >= 0 ? byteLength : 0
    ));
  }

  setString(index: number, value: string): void {
    const {
      stringEncoded,
      stringByteOffset: start,
      valueByteOffset: byteStart,
      offsetsView,
      valueView,
      typesView,
      stringsView,
    } = this;

    typesView.setUint8(index, PropertyValueType.String);

    const cachedIndex = this.dictionary[value];
    if (cachedIndex !== undefined) {
      valueView.setUint32(byteStart, cachedIndex);
      offsetsView.setUint32(index * 4, byteStart);

      this.valueByteOffset += 4;

      return;
    }

    this.dictionary[value] = start;
    const bytesWritten = utf8EncodeJs(value, stringEncoded, start + 4);
    stringsView.setUint32(start, bytesWritten);

    valueView.setUint32(byteStart, start);
    offsetsView.setUint32(index * 4, byteStart);

    this.valueByteOffset += 4;
    this.stringByteOffset += bytesWritten + 4;
  }
}

export class BatchByteColumn extends ByteColumn {
  static fromColumnBytes(columnBytes: ColumnBytes): BatchByteColumn {
    return new BatchByteColumn(columnBytes);
  }

  static fromArray(values: PropertyValue[]): BatchByteColumn {
    const column = new BatchByteColumn(createColumnBytes(values.length));
    for (let i = 0; i < values.length; i++) {
      column.setValue(i, values[i]);
    }

    return column;
  }

  decoder = new TextDecoder();
  encoder = new TextEncoder();

  decodeCache: string[];
  encodeCache: string[] = [];

  toColumnBytes(): ColumnBytes {
    const r = this.encoder.encodeInto(
      this.encodeCache.join(separator),
      this.stringEncoded
    );

    return {
      stringBuffer: this.stringEncoded.slice(0, r.written).buffer,
      buffer: this.buffer.slice(0),

      stringCount: this.stringCount,
      byteOffset: this.valueByteOffset,
      stringOffset: this.stringByteOffset,
      length: this.length,
    };
  }

  // byte offsets encoding
  setString(index: number, value: string) {
    const {
      valueByteOffset: valueByteStart,
      offsetsView,
      valueView,
      typesView,
      encodeCache,
      stringCount,
    } = this;

    encodeCache[stringCount] = value;

    valueView.setUint32(valueByteStart, stringCount | 0);
    offsetsView.setUint32(index * 4, valueByteStart | 0);
    this.valueByteOffset += 4;
    this.stringCount += 1;

    typesView.setUint8(index, PropertyValueType.String);
  }

  getString(index: number): string {
    const { stringEncoded, valueView: view, offsetsView } = this;
    const valueIndex = offsetsView.getUint32(index * 4);
    const stringIndex = view.getUint32(valueIndex);

    if (!this.decodeCache) {
      this.decodeCache = this.decoder.decode(stringEncoded).split(separator);
    }

    return this.decodeCache[stringIndex];
  }
}
