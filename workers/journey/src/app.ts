import { Hono } from "hono";

type Env = {
  Bindings: {
    DB: Hyperdrive;
    KV: KVNamespace;
  };
};

const app = new Hono<Env>();

// TODO: Add routes from contracts
app.get("/health", (c) => c.json({ status: "ok" }));

export default app;
