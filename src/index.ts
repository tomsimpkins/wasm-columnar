import { initTimer } from "./timings";
import { isEqual } from "./assert";
import { makeData } from "./makeData";
import {
  DictionaryByteColumn,
  ByteColumn,
  BatchByteColumn,
} from "./ByteColumn";
import WebWorker from "web-worker:./Worker.ts";
import {
  RequestMessageData,
  PropertyValue,
  PropertyValueType,
  ResponseMessageData,
} from "./types";
import { initWasm, compact } from "./compactStrings";

const sleep = (ms: number): Promise<void> =>
  new Promise((res) => setTimeout(() => res(undefined), ms));

const itemCount = 500000;
const seed = 5;
const types: PropertyValueType[] = [PropertyValueType.String];

async function main(): Promise<void> {
  await initWasm();
  compact();

  const worker = new WebWorker();

  worker.addEventListener(
    "message",
    (evt: MessageEvent<ResponseMessageData>) => {
      const aliveTime = Date.now();

      const timer = initTimer();
      timer.time("get message sent time");
      const sentTime = evt.data.messageSendTime;
      timer.timeEnd("get message sent time");
      const postMessageTime = aliveTime - sentTime;

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

        case "roundTripDict": {
          timer.time("reify column");
          const byteColumn = DictionaryByteColumn.fromColumnBytes(
            evt.data.payload
          );
          const reified = byteColumn.reify();
          timer.timeEnd("reify column");

          result = reified;

          break;
        }

        case "roundTripBatch": {
          timer.time("reify column");
          const byteColumn = BatchByteColumn.fromColumnBytes(evt.data.payload);
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

      const data = makeData(itemCount, seed, types);
      isEqual(data, result);

      console.log("timings", evt.data.type, allTimings, totalTime);
    }
  );

  const initMessage: RequestMessageData = { type: "init" };
  worker.postMessage(initMessage);

  await sleep(1000);
  const batchByteColumnMessage: RequestMessageData = {
    type: "roundTripBatch",
    args: [{ itemCount, seed, types }],
  };
  worker.postMessage(batchByteColumnMessage);

  // await sleep(1000);
  // const jsonMessage: RequestMessageData = {
  //   type: "roundTripJson",
  //   args: [{ itemCount, seed, types }],
  // };
  // worker.postMessage(jsonMessage);

  // await sleep(1000);
  // const byteColumnMessage: RequestMessageData = {
  //   type: "roundTrip",
  //   args: [{ itemCount, seed, types }],
  // };
  // worker.postMessage(byteColumnMessage);

  // await sleep(1000);
  // const dictByteColumnMessage: RequestMessageData = {
  //   type: "roundTripDict",
  //   args: [{ itemCount, seed, types }],
  // };
  // worker.postMessage(dictByteColumnMessage);

  await sleep(1000);
  const baselineMessage: RequestMessageData = {
    type: "roundTripRaw",
    args: [{ itemCount, seed, types }],
  };
  worker.postMessage(baselineMessage);
}

window.addEventListener("DOMContentLoaded", () => {
  main();
});
