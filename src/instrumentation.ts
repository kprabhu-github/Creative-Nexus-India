// Process-level stability handlers. Runs once per Node process boot.
// Without these, an uncaughtException or unhandledRejection in any code path
// (route handler, background promise) takes down the entire Node process,
// causing a supervisor crashloop. We log and keep running — a single bad
// request should never kill the whole app.
//
// Enabled via experimental.instrumentationHook in next.config.mjs.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  process.on("uncaughtException", (err) => {
    // Log + survive. Without this handler, Node dies on the next tick.
    console.error("[uncaughtException] keeping process alive:", err);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[unhandledRejection] keeping process alive:", reason);
  });

  // Optional: emit a startup heartbeat so we can correlate restarts in logs.
  console.log(
    `[instrumentation] process ${process.pid} ready @ ${new Date().toISOString()}`,
  );
}
