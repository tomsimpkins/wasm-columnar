export const initTimer = (): Timer => {
  const timings = {};

  return {
    time: (key: string) => {
      timings[key] = performance.now();
    },
    timeEnd: (key: string) => {
      timings[key] = performance.now() - timings[key];
    },
    timings,
  };
};

export type Timer = {
  time: (key: string) => void;
  timeEnd: (key: string) => void;
  timings: Record<string, number>;
};
