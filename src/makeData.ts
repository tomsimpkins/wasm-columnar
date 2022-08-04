import { PropertyValue } from "./types";

function mulberry32(a) {
  return function () {
    var t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const makeData = (length: number, seed: number) => {
  const rng = mulberry32(seed);

  const res: PropertyValue[] = Array.from({ length }, () => {
    const r = rng();
    switch (true) {
      case false && r < 0.25: {
        return rng() < 0.5;
      }
      case false && r < 0.5: {
        return rng() * 100000 - 50000;
      }
      case true || r < 0.75: {
        return (
          rng().toString(32).substr(2) +
          rng().toString(32).substr(2) +
          rng().toString(32).substr(2) +
          rng().toString(32).substr(2) +
          rng().toString(32).substr(2) +
          rng().toString(32).substr(2)
        );
      }
      case r < 1: {
        const future = new Date(2050, 10, 10).getTime();
        const past = new Date(1902, 5, 1).getTime();

        return new Date(rng() * (future - past) + past);
      }
    }
  });

  return res;
};
