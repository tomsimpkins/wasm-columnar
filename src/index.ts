import WebWorker from "web-worker:./Worker.ts";

function main(): void {
  const worker = new WebWorker();
  worker.addEventListener("message", (evt) => {
    console.log(evt);
  });

  worker.postMessage({
    type: "init",
    args: "This instance was created in a worker",
  });

  worker.postMessage({ type: "exec", func: "sayHello", args: "web worker" });
}

window.addEventListener("DOMContentLoaded", () => {
  main();
});
