import { decodeDate, encodeDate } from "./dateUtils";
import { utf8DecodeJs, utf8EncodeJs } from "./stringUtils";
import { PropertyValue, PropertyValueType } from "./types";

// Column must give access by index
// Must give reified column quickly
// Must have fast serializable representation

const createColumnBytes = (length: number): ColumnBytes => {
  return {
    stringBuffer: new Uint8Array(length * 50),
    buffer: new ArrayBuffer(length + 4 * length + 8 * length), // types + offsets + values
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

  length: number;
};

export class ByteColumn {
  static fromColumnBytes(jsonColumn: ColumnBytes): ByteColumn {
    return new ByteColumn(jsonColumn);
  }

  toColumnBytes(): ColumnBytes {
    return {
      stringBuffer: this.stringEncoded.buffer.slice(0),
      buffer: this.buffer.slice(0),

      byteOffset: this.byteOffset,
      stringOffset: this.stringOffset,
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
    const { getValue, reified, length } = this;
    for (let i = 0; i < length; i++) {
      reified[i] = getValue(i);
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

  private byteOffset: number;
  private stringOffset: number;
  private length: number;

  private buffer: ArrayBuffer;
  private valueView: DataView;
  private typesView: DataView;
  private offsetsView: DataView;

  private stringEncoded: Uint8Array;
  private reified: PropertyValue[];

  constructor(initialState: ColumnBytes) {
    this.byteOffset = initialState.byteOffset;
    this.stringOffset = initialState.stringOffset;
    this.length = initialState.length;

    this.stringEncoded = new Uint8Array(initialState.stringBuffer);
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

  getValue = (index: number): PropertyValue => {
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
  };

  setValue(index: number, value: PropertyValue) {
    const i = index | 0;
    const safeType = ByteColumn.getValueType(value) | 0;
    this.reified[i] = value;

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
      stringOffset: start,
      byteOffset: byteStart,
      offsetsView,
      valueView,
      typesView,
    } = this;

    const bytesWritten = utf8EncodeJs(value, stringEncoded, start);

    valueView.setUint32(byteStart, start);
    valueView.setUint32(byteStart + 4, bytesWritten);
    offsetsView.setUint32(index * 4, byteStart);

    this.byteOffset += 8;
    this.stringOffset += bytesWritten;

    typesView.setUint8(index, PropertyValueType.String);
  }

  getString(index: number): string {
    const { stringEncoded, valueView: view } = this;
    const start = view.getUint32(this.offsetsView.getUint32(index * 4));
    const byteLength = view.getUint32(
      this.offsetsView.getUint32(index * 4) + 4
    );

    return utf8DecodeJs(stringEncoded, start, byteLength >= 0 ? byteLength : 0);
  }

  setNumber(index: number, value: number) {
    const { typesView, valueView, offsetsView, byteOffset: offsetStart } = this;

    valueView.setFloat64(offsetStart, value);
    offsetsView.setUint32(index * 4, offsetStart);
    this.byteOffset += 8;

    typesView.setUint8(index, PropertyValueType.Number);
  }

  getNumber(index: number): number {
    return this.valueView.getFloat64(this.offsetsView.getUint32(index * 4));
  }

  setDate(index: number, value: Date) {
    const { valueView, offsetsView, byteOffset: startOffset, typesView } = this;

    valueView.setUint32(startOffset, encodeDate(value));
    offsetsView.setUint32(index * 4, startOffset);
    this.byteOffset += 4;

    typesView.setUint8(index, PropertyValueType.Date);
  }

  getDate(index: number) {
    const v = this.valueView.getUint32(this.offsetsView.getUint32(index * 4));

    return decodeDate(v);
  }

  setBoolean(index: number, value: boolean) {
    const { byteOffset: startOffset, valueView, offsetsView, typesView } = this;

    const v = value ? 1 : 0;
    valueView.setUint8(startOffset, v);
    offsetsView.setUint32(index * 4, startOffset);
    this.byteOffset += 1;

    typesView.setUint8(index, PropertyValueType.Boolean);
  }

  getBoolean(index: number): boolean {
    return this.valueView.getUint8(this.offsetsView.getUint32(index * 4)) > 0;
  }
}

// export const execTests = async () => {
//   const s0 = Date.now();
//   const data = makeData(300000);
//   const e0 = Date.now();
//   console.log(`make data ${e0 - s0}`);

//   const sc = Date.now();
//   data.slice();
//   const ec = Date.now();
//   console.log(`clone data ${ec - sc}`);

//   const s = Date.now();
//   const col = Column.fromArray(data);
//   const e = Date.now();
//   console.log(`init ${e - s}`);

//   const s1 = Date.now();
//   const colBytes = col.toColumnBytes();
//   const e1 = Date.now();
//   console.log(`to bytes ${e1 - s1}`);

//   // await sleep(4000)
//   const s2 = Date.now();
//   const cloned = await promisePostMessage(colBytes, [
//     colBytes.stringBuffer,
//     colBytes.buffer,
//   ]);
//   const e2 = Date.now();
//   console.log(`postmessage compressed ${e2 - s2}`);

//   // await sleep(4000)
//   const s3 = Date.now();
//   await promisePostMessage(data);
//   const e3 = Date.now();
//   console.log(`postmessage full ${e3 - s3}`);

//   const s4 = Date.now();
//   const reified = Column.fromColumnBytes(cloned).reify();
//   const e4 = Date.now();
//   console.log(`reify data ${e4 - s4}`);

//   assertEqual(reified, data);
// };
