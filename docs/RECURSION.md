# RECURSION

## Idea

`Genesys.start(prompt)` produce stream. At end of `run()`, logic decide: spawn next `Genesys.start(nextPrompt)`. Chain continue until stop condition.

Outer stream stay open across hops. Consumer see one flat stream of chunks from whole chain.

## Flow

```
Genesys.start(p0) ──► Stream S0
    │
    run()
    ├── emit chunks...
    ├── decide(lastState) → { continue: true, next: p1 }
    │
    └── chain into Genesys.start(p1) ──► Stream S1
             │
             ├── pipe S1 chunks into S0
             ├── decide(...) → { continue: true, next: p2 }
             └── chain into Genesys.start(p2) ...
                      │
                      └── decide(...) → { continue: false }
                               │
                               └── finish S0
```

## Structure

```
Genesys
├── state
│   ├── prompt
│   ├── depth       : number           // recursion depth
│   ├── parent      : Genesys | null   // who spawned me
│   └── ...base state from ARCHITECTURE.md
│
├── static start(prompt, opts?) → Stream
│
├── run()
│   ├── do work, emit chunks
│   ├── decision ← shouldContinue(state)
│   └── if decision.continue
│         └── chainInto(decision.nextPrompt)
│       else
│         └── finish()
│
├── shouldContinue(state) → { continue, nextPrompt? }
│     // pluggable logic — TBD
│
└── chainInto(nextPrompt)
      child ← Genesys.start(nextPrompt, { parent: this, depth: this.depth + 1 })
      pipe child stream → this.emit
      on child done → this.finish()
```

## Pseudo code

```
class Genesys

    private depth: number
    private parent: Genesys | null

    static async start(prompt, opts = {}) → Stream
        validate prompt
        enforce depth limit (opts.depth ?? 0) < MAX_DEPTH
        instance ← new Genesys(prompt, opts)
        kick off instance.run()
        return instance.stream

    private async run()
        try
            do work, calling this.emit(chunk) as chunks produced
            decision ← this.shouldContinue(lastState)

            if decision.continue
                await this.chainInto(decision.nextPrompt)
            // else fall through to finish()
        catch error
            this.emit(error chunk)
        finally
            if not chained
                this.finish()

    private shouldContinue(state) → { continue: bool, nextPrompt?: string }
        // logic: check goal met, tool requested, follow-up needed, etc.
        // return { continue: false } to stop
        // return { continue: true, nextPrompt: "..." } to recurse

    private async chainInto(nextPrompt)
        child ← Genesys.start(nextPrompt, {
            parent: this,
            depth:  this.depth + 1,
        })
        for await chunk of child
            this.emit(chunk)       // forward to outer consumer
        this.finish()              // child done → outer done
```

## Stop conditions

- `decision.continue === false`
- `depth >= MAX_DEPTH` (hard cap, prevent runaway)
- consumer abort outer stream → cancel chain
- error in any hop → emit error, finish chain

## Open questions

- Flatten chunks or tag with `depth` / `hopId`?
- Share state across hops (memory, history) or fresh each?
- Parallel branch (fan-out) vs strict linear chain?
- Abort propagation: outer abort → cancel current child only, or whole subtree?
