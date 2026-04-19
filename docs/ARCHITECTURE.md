# ARCHITECTURE

## Overview

`Genesys.start(prompt)` returns a `Stream` immediately. Work run in background. Chunks pushed to consumer via async iterable.

## Structure

```
Genesys
├── internal state
│   ├── prompt     : string
│   ├── stream     : Stream            // async iterable returned to caller
│   ├── buffer     : Chunk[]           // chunks waiting to be read
│   ├── waiters    : Resolver[]        // consumers parked on next()
│   └── finished   : boolean
│
├── construction
│   └── private constructor(prompt)
│
├── public
│   └── static start(prompt) → Stream
│
├── producer (background)
│   ├── run()            // do work, emit chunks
│   ├── emit(chunk)      // hand to waiter or buffer
│   └── finish()         // mark done, wake waiters
│
└── consumer (inside stream)
    └── iterator.next()  // buffer → waiter → done
```

## Flow

```
caller ── Genesys.start(prompt) ──► Stream
                │
                └── run() runs in background
                         │
                         ├── emit(chunk) ──► buffer / waiter
                         └── finish()    ──► wake waiters (done)

caller ── for await (chunk of stream) ──► iterator.next()
                                               │
                                               ├── buffer non-empty → return chunk
                                               ├── finished          → return done
                                               └── else              → park waiter
```

## Pseudo code

```
class Genesys

    // ─── internal state ────────────────────────────────
    private prompt: string
    private stream: Stream        // the async iterable we'll return
    private buffer: Chunk[]       // chunks waiting to be read
    private waiters: Resolver[]   // consumers waiting for next chunk
    private finished: boolean

    // ─── construction ──────────────────────────────────
    private constructor(prompt)
        this.prompt   = prompt
        this.buffer   = []
        this.waiters  = []
        this.finished = false
        this.stream   = build async iterable backed by buffer/waiters

    // ─── public entry point ────────────────────────────
    static async start(prompt) → Stream
        validate prompt
        instance ← new Genesys(prompt)
        kick off instance.run()   // fire-and-forget, runs in background
        return instance.stream

    // ─── core loop (background) ────────────────────────
    private async run()
        try
            do the work, calling this.emit(chunk) as chunks are produced
        catch error
            this.emit(error chunk)   // or handle differently — TBD
        finally
            this.finish()

    // ─── producer side ─────────────────────────────────
    private emit(chunk)
        if a waiter is queued
            hand chunk directly to waiter
        else
            push chunk into buffer

    private finish()
        this.finished = true
        wake up any remaining waiters so they see "done"

    // ─── consumer side (inside this.stream) ────────────
    iterator.next()
        if buffer has chunk  → return it
        if finished          → return done
        otherwise            → register a waiter, wait for emit()
```

## Notes

- Producer never block. `emit` sync handoff or push.
- Consumer park via `waiters` when buffer empty + not finished.
- Backpressure: none yet. Buffer unbounded. TBD.
- Error path: emit error chunk then finish. Alt: reject iterator. TBD.
