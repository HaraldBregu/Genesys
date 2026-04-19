# START

## Usage

```ts
const stream = Genesys.create({ input: anything });

for await (const chunk of stream) {
  console.log(chunk);
}
```

## Pseudo flow

```
input  ──► Genesys.create(input)
              │
              ├─ normalize(input)        // any → internal shape
              ├─ plan(input)             // pick pipeline/agents
              ├─ execute(plan)           // run steps, emit events
              │
              └─► returns AsyncIterable<Chunk>

Chunk =
  | { type: "token",  data: string }
  | { type: "event",  name: string, payload: any }
  | { type: "error",  error: Error }
  | { type: "done",   result: any }
```

## Consumer patterns

```ts
// 1. stream tokens
for await (const c of Genesys.create(input)) { ... }

// 2. await final
const { result } = await Genesys.create(input).final();

// 3. cancel
const stream = Genesys.create(input);
stream.abort();
```
