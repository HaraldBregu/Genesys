import { Runner } from "./runner/runner";
import { randomContinue } from "./runner/strategy";

async function main() {
  const stream = Runner.start("hi how are you", { shouldContinue: randomContinue });

  for await (const chunk of stream) {
    switch (chunk.type) {
      case "token":
        console.log(`token: ${chunk.data}`);
        break;
      case "event":
        console.log(`event:${chunk.name}`, chunk.payload);
        break;
      case "error":
        console.error("error:", chunk.error);
        break;
      case "done":
        console.log("done:", chunk.result);
        break;
    }
  }
}

main();
