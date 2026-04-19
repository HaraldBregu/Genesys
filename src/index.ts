import { Runner } from "./runner/runner";

async function main() {
  const input = "hi how are you";
  const stream = await Runner.run(input);

  for await (const event of stream) {
    console.log(`[${event.prompt}] continue? ${event.shouldContinue}`);
    if (event.done) console.log(`[${event.prompt}] done`);
  }

}

main();
