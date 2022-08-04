import { initTimings } from "./timings";
import { makeData } from "./makeData";
import { ByteColumn } from "./ByteColumn";
import { MessageData } from "./types";

self.addEventListener("message", async (e: MessageEvent<MessageData>) => {
  console.log(e);
  const fakeConsole = initTimings();
  const message = e.data;

  switch (message.type) {
    case "init":
      break;

    case "roundTrip": {
      const [{ itemCount, seed }] = message.args;

      const data = makeData(itemCount, seed);

      const strings = data.filter((v) => typeof v === "string");
      console.time("strings encode special " + strings.length);
      const encoded = new TextEncoder().encode(JSON.stringify(strings));
      console.timeEnd("strings encode special " + strings.length);

      console.time("strings decode special " + strings.length);
      JSON.parse(new TextDecoder().decode(encoded));
      console.timeEnd("strings decode special " + strings.length);

      fakeConsole.time("init byte column");
      const byteColumn = ByteColumn.fromArray(data);
      fakeConsole.timeEnd("init byte column");

      fakeConsole.time("get column bytes");
      const bytePayload = byteColumn.toColumnBytes();
      fakeConsole.timeEnd("get column bytes");

      postMessage(
        {
          type: message.type,
          bytePayload,
          timings: fakeConsole.timings,
          messageSendTime: Date.now(), // cannot use performance.now because performance is measured from isolate instantiation
        },
        {
          transfer: [bytePayload.buffer, bytePayload.stringBuffer],
        }
      );

      break;
    }

    case "roundTripRaw": {
      const [{ itemCount, seed }] = message.args;

      const data = makeData(itemCount, seed);

      fakeConsole.time("slice raw data");
      const clonedData = data.slice();
      fakeConsole.timeEnd("slice raw data");

      postMessage({
        type: message.type,
        clonedData,
        timings: fakeConsole.timings,
        messageSendTime: Date.now(), // cannot use performance.now because performance is measured from isolate instantiation
      });
      break;
    }

    case "roundTripJson": {
      const [{ itemCount, seed }] = message.args;

      const data = makeData(itemCount, seed);

      fakeConsole.time("json stringify");
      const clonedData = JSON.stringify(data);
      fakeConsole.timeEnd("json stringify");

      postMessage({
        type: message.type,
        clonedData,
        timings: fakeConsole.timings,
        messageSendTime: Date.now(), // cannot use performance.now because performance is measured from isolate instantiation
      });
      break;
    }

    default:
      break;
  }
});
