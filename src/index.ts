import { initTimer } from "./timings";
import { isEqual } from "./assert";
import { makeData } from "./makeData";
import { ByteColumn } from "./ByteColumn";
import WebWorker from "web-worker:./Worker.ts";
import { RequestMessageData, PropertyValue } from "./types";

const sleep = (ms: number): Promise<void> =>
  new Promise((res) => setTimeout(() => res(undefined), ms));

const itemCount = 500000;
const seed = 5;
async function main(): Promise<void> {
  const worker = new WebWorker();

  worker.addEventListener("message", (evt) => {
    const timer = initTimer();
    timer.time("get postmessage time");
    const postMessageTime = Date.now() - evt.data.messageSendTime;
    timer.timeEnd("get postmessage time");

    let result: PropertyValue[] = [];
    switch (evt.data.type) {
      case "roundTrip": {
        timer.time("reify column");
        const byteColumn = ByteColumn.fromColumnBytes(evt.data.payload);
        const reified = byteColumn.reify();
        timer.timeEnd("reify column");

        result = reified;

        break;
      }

      case "roundTripRaw": {
        result = evt.data.payload;
        break;
      }

      case "roundTripJson": {
        timer.time("json parse");
        const revived = JSON.parse(evt.data.payload);
        timer.timeEnd("json parse");
        result = revived;
        break;
      }
    }

    const allTimings = Object.assign(evt.data.timings, timer.timings, {
      postMessageTime,
    });
    const totalTime = Object.values(allTimings).reduce((a, b) => a + b);

    const data = makeData(itemCount, seed);
    isEqual(data, result);

    console.log("timings", allTimings, totalTime);
  });

  const initMessage: RequestMessageData = { type: "init" };
  worker.postMessage(initMessage);

  await sleep(1000);
  const jsonMessage: RequestMessageData = {
    type: "roundTripJson",
    args: [{ itemCount, seed }],
  };
  worker.postMessage(jsonMessage);

  await sleep(1000);
  const byteColumnMessage: RequestMessageData = {
    type: "roundTrip",
    args: [{ itemCount, seed }],
  };
  worker.postMessage(byteColumnMessage);

  await sleep(1000);
  const baselineMessage: RequestMessageData = {
    type: "roundTripRaw",
    args: [{ itemCount, seed }],
  };
  worker.postMessage(baselineMessage);
}

window.addEventListener("DOMContentLoaded", () => {
  main();
});
