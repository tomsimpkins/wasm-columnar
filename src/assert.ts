import { ByteColumn } from "./ByteColumn";
import { PropertyValue, PropertyValueType } from "./types";

export const assertEqual = (xs: PropertyValue[], ys: PropertyValue[]) => {
  if (!(xs.length === ys.length)) {
    throw new Error(`lengths differ ${xs.length}, ${ys.length}`);
  }

  for (let i = 0; i < xs.length; i++) {
    const x = xs[i];
    const y = ys[i];

    const xType = ByteColumn.getValueType(x);
    const yType = ByteColumn.getValueType(y);
    if (xType !== yType) {
      throw new Error(`item ${i} differs in type`);
    }

    switch (xType) {
      case PropertyValueType.String:
      case PropertyValueType.Number:
      case PropertyValueType.Boolean:
      case PropertyValueType.Undefined: {
        if (x !== y) {
          throw new Error(`values differ at ${i}, x:${x} y:${y}`);
        }
        break;
      }
      case PropertyValueType.Date: {
        const xDate = x as Date;
        const yDate = y as Date;
        if (
          !(
            xDate.getUTCFullYear() === yDate.getUTCFullYear() &&
            xDate.getUTCMonth() === yDate.getUTCMonth() &&
            xDate.getUTCDate() === yDate.getUTCDate()
          )
        ) {
          throw new Error(`values differ at ${i}, x:${x} y:${y}`);
        }
        break;
      }
    }
  }
};

export const isEqual = (
  xs: PropertyValue[],
  ys: PropertyValue[]
): string | true => {
  try {
    assertEqual(xs, ys);
    return true;
  } catch (e) {
    return e.message;
  }
};
