import { initTimer } from "./timings";
import { makeData } from "./makeData";
import { DictionaryByteColumn, ByteColumn } from "./ByteColumn";
import { RequestMessageData } from "./types";

self.addEventListener(
  "message",
  async (e: MessageEvent<RequestMessageData>) => {
    if (e.data.type === "init") {
      return;
    }

    const timer = initTimer();
    const message = e.data;
    const [{ itemCount, seed, types }] = message.args;
    const data = makeData(itemCount, seed, types);

    switch (message.type) {
      case "roundTrip": {
        timer.time("init byte column");
        const byteColumn = ByteColumn.fromArray(data);
        timer.timeEnd("init byte column");

        timer.time("get column bytes");
        const bytePayload = byteColumn.toColumnBytes();
        timer.timeEnd("get column bytes");

        postMessage(
          {
            type: message.type,
            payload: bytePayload,
            timings: timer.timings,
            messageSendTime: Date.now(), // cannot use performance.now because performance is measured from isolate instantiation
          },
          {
            transfer: [bytePayload.buffer, bytePayload.stringBuffer],
          }
        );

        break;
      }

      case "roundTripDict": {
        timer.time("init byte column");
        const byteColumn = ByteColumn.fromArray(data);
        timer.timeEnd("init byte column");

        const dictByteColumn = DictionaryByteColumn.fromArray(data);
        timer.time("get column bytes");
        const bytePayload = dictByteColumn.toColumnBytes();
        timer.timeEnd("get column bytes");

        postMessage(
          {
            type: message.type,
            payload: bytePayload,
            timings: timer.timings,
            messageSendTime: Date.now(), // cannot use performance.now because performance is measured from isolate instantiation
          },
          {
            transfer: [bytePayload.buffer, bytePayload.stringBuffer],
          }
        );

        break;
      }

      case "roundTripRaw": {
        timer.time("slice raw data");
        const clonedData = data.slice();
        timer.timeEnd("slice raw data");

        postMessage({
          type: message.type,
          payload: clonedData,
          timings: timer.timings,
          messageSendTime: Date.now(), // cannot use performance.now because performance is measured from isolate instantiation
        });
        break;
      }

      case "roundTripJson": {
        timer.time("json stringify");
        const clonedData = JSON.stringify(data);
        timer.timeEnd("json stringify");

        postMessage({
          type: message.type,
          payload: clonedData,
          timings: timer.timings,
          messageSendTime: Date.now(), // cannot use performance.now because performance is measured from isolate instantiation
        });
        break;
      }

      default:
        break;
    }
  }
);
