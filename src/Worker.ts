import { ByteColumn } from "./ByteColumn";
import { MessageManager } from "./MessageManager";

let messageManager: MessageManager | null = null;

function executeFunction<T extends MessageManager>(
  target: T,
  func: keyof T,
  args: any
): void {
  (target[func] as unknown as Function)(args);
}

const sleep = (ms: number) =>
  new Promise((res) => {
    setTimeout(() => res(undefined), ms);
  });

self.addEventListener("message", async (e) => {
  const message = e.data || e;

  switch (message.type) {
    case "init":
      messageManager = new MessageManager(message.args);
      break;

    case "exec":
      if (messageManager) {
        // executeFunction(messageManager, message.func, message.args);
        await sleep(5000);
        postMessage("foobar");
        console.log(ByteColumn.fromArray([1, 2, 3]));
      }
      break;

    default:
      break;
  }
});
