export const initTimings = () => {
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
