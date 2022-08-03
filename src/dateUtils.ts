export const encodeDate = (value: Date): number => {
  const y = value.getUTCFullYear();
  const m = value.getUTCMonth();
  const d = value.getUTCDate();

  return (y << 9) | (m << 5) | (d << 0);
};

const unmaskY = parseInt("11111111111111111000000000", 2);
const unmaskM = parseInt("00000000000000000111100000", 2);
const unmaskD = parseInt("00000000000000000000011111", 2);
export const decodeDate = (value: number): Date => {
  return new Date(
    Date.UTC(
      (unmaskY & value) >> 9,
      (unmaskM & value) >> 5,
      (unmaskD & value) >> 0
    )
  );
};
