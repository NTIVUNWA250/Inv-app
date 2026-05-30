import express, { type Express } from "express";
import cors from "cors";
import { env } from "./env.js";
import { errorHandler } from "./http.js";
import { authRouter } from "./routes/auth.js";
import { profilesRouter } from "./routes/profiles.js";
import { locationsRouter } from "./routes/locations.js";
import { itemsRouter } from "./routes/items.js";
import { stockRouter } from "./routes/stock.js";
import { movementsRouter } from "./routes/movements.js";

export function createApp(): Express {
  const app = express();

  app.use(
    cors({
      origin: env.corsOrigins.includes("*") ? true : env.corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json());

  // Liveness probe — no auth.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "inventory-api" });
  });

  app.use("/auth", authRouter);
  app.use("/profiles", profilesRouter);
  app.use("/locations", locationsRouter);
  app.use("/items", itemsRouter);
  app.use("/stock", stockRouter);
  app.use("/movements", movementsRouter);

  // 404 for anything unmatched.
  app.use((_req, res) => {
    res.status(404).json({ error: { message: "Route not found.", code: "not_found" } });
  });

  app.use(errorHandler);

  return app;
}
