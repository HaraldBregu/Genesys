import { AgentBuilder, OpenAIProvider } from "./agent";
import { Runner } from "./runner/runner";
import { neverContinue } from "./runner/strategy";

async function main() {
  const agent = AgentBuilder.create("assistant")
    .provider(new OpenAIProvider({ apiKey: process.env.OPENAI_API_KEY }))
    .model("gpt-4o-mini")
    .instructions("You are a concise helpful assistant.")
    .temperature(0.2)
    .build();

  const stream = Runner.start("hi how are you", {
    agent,
    shouldContinue: neverContinue,
  });

  for await (const chunk of stream) {
    switch (chunk.type) {
      case "token":
        process.stdout.write(chunk.data);
        break;
      case "event":
        console.log(`\n[event:${chunk.name}]`, chunk.payload);
        break;
      case "error":
        console.error("\nerror:", chunk.error);
        break;
      case "done":
        console.log("\ndone:", chunk.result);
        break;
    }
  }
}

main();
