import { PropertyValue, PropertyValueType } from "./types";

function mulberry32(a) {
  return function () {
    var t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const makeData = (
  length: number,
  seed: number,
  types?: PropertyValueType[]
) => {
  if (types === undefined || types.length === 0) {
    types = Object.values(PropertyValueType).filter(
      (k): k is PropertyValueType => typeof k !== "string"
    );
  }

  const rng = mulberry32(seed);

  const res: PropertyValue[] = Array.from({ length }, () => {
    const r = rng();
    const type = types[(r * types.length) | 0];

    switch (type) {
      case PropertyValueType.Boolean: {
        return rng() < 0.5;
      }
      case PropertyValueType.Number: {
        return rng() * 100000 - 50000;
      }
      case PropertyValueType.String: {
        return (
          rng().toString(32).substr(2) +
          rng().toString(32).substr(2) +
          rng().toString(32).substr(2) +
          rng().toString(32).substr(2) +
          rng().toString(32).substr(2) +
          rng().toString(32).substr(2)
        );
      }
      case PropertyValueType.Date: {
        const future = new Date(2050, 10, 10).getTime();
        const past = new Date(1902, 5, 1).getTime();

        return new Date(rng() * (future - past) + past);
      }
      case PropertyValueType.Undefined: {
        return undefined;
      }
      default: {
        throw new Error("Could not generate value");
      }
    }
  });

  return res;
};
