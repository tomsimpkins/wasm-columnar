import { initTimings } from "./timings";
import { isEqual } from "./assert";
import { makeData } from "./makeData";
import { ByteColumn } from "./ByteColumn";
import WebWorker from "web-worker:./Worker.ts";
import { MessageData } from "./types";

const sleep = (ms: number): Promise<void> =>
  new Promise((res) => setTimeout(() => res(undefined), ms));

const itemCount = 500000;
const seed = 5;
async function main(): Promise<void> {
  const worker = new WebWorker();

  worker.addEventListener("message", (evt) => {
    switch (evt.data.type) {
      case "roundTrip": {
        const postMessageTime = Date.now() - evt.data.messageSendTime;

        const fakeConsole = initTimings();
        fakeConsole.time("reify column");
        const byteColumn = ByteColumn.fromColumnBytes(evt.data.bytePayload);
        const reified = byteColumn.reify();
        fakeConsole.timeEnd("reify column");

        const data = makeData(itemCount, seed);
        console.log("equal", isEqual(data, reified));
        const allTimings = Object.assign(
          fakeConsole.timings,
          evt.data.timings,
          {
            postMessageTime,
          }
        );
        const totalTime = Object.values(allTimings).reduce((a, b) => a + b);

        console.log("timings", allTimings, totalTime);
        break;
      }
      case "roundTripRaw": {
        const postMessageTime = Date.now() - evt.data.messageSendTime;
        const allTimings = Object.assign(evt.data.timings, { postMessageTime });
        const totalTime = Object.values(allTimings).reduce((a, b) => a + b);

        console.log("timings", evt.data.timings, totalTime);
        break;
      }
      case "roundTripJson": {
        const postMessageTime = Date.now() - evt.data.messageSendTime;
        const fakeConsole = initTimings();
        fakeConsole.time("json parse");
        const revived = JSON.parse(evt.data.clonedData);
        fakeConsole.timeEnd("json parse");
        const allTimings = Object.assign(
          evt.data.timings,
          fakeConsole.timings,
          { postMessageTime }
        );
        const totalTime = Object.values(allTimings).reduce((a, b) => a + b);

        console.log("timings", evt.data.timings, totalTime);
        break;
      }
    }
  });

  const initMessage: MessageData = {
    type: "init",
  };
  worker.postMessage(initMessage);
  await sleep(1000);

  const goMessage: MessageData = {
    type: "roundTrip",
    args: [{ itemCount, seed }],
  };
  worker.postMessage(goMessage);
  await sleep(1000);

  const baselineMessage: MessageData = {
    type: "roundTripRaw",
    args: [{ itemCount, seed }],
  };
  worker.postMessage(baselineMessage);
  await sleep(1000);

  const jsonMessage: MessageData = {
    type: "roundTripJson",
    args: [{ itemCount, seed }],
  };
  worker.postMessage(jsonMessage);
}

window.addEventListener("DOMContentLoaded", () => {
  main();
});
