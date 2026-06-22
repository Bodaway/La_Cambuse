import type { IncomingMessage, ServerResponse } from "node:http";
import { text } from "node:stream/consumers";
import type { Connect, Plugin } from "vite";
import { createAIProvider } from "../ai/index.js";
import { createAiApiHandler } from "./ai-api.js";

const sendJson = (
  res: ServerResponse,
  status: number,
  body: unknown,
): void => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

// Middleware de DÉVELOPPEMENT uniquement : expose POST /api/ai et route la
// requête vers la couche IA (createAIProvider). Le CLI Claude étant dev-only,
// ce pont n'existe pas en production (un vrai backend prendra le relais).
export const aiDevServerPlugin = (): Plugin => ({
  name: "la-cambuse-ai-dev-server",
  configureServer: (server) => {
    const providerResult = createAIProvider();
    server.middlewares.use(
      "/api/ai",
      (
        req: IncomingMessage,
        res: ServerResponse,
        next: Connect.NextFunction,
      ): void => {
        if (req.method !== "POST") {
          next();
          return;
        }
        if (providerResult.isErr()) {
          sendJson(res, 500, {
            error: {
              code: providerResult.error.code,
              message: providerResult.error.message,
            },
          });
          return;
        }
        const handle = createAiApiHandler(providerResult.value);
        void text(req)
          .then((raw): unknown => JSON.parse(raw))
          .then((parsed) => handle(parsed))
          .then((apiResponse) => {
            sendJson(res, apiResponse.status, apiResponse.body);
          })
          .catch((): void => {
            sendJson(res, 400, {
              error: { code: "bad_request", message: "Corps de requête invalide." },
            });
          });
      },
    );
  },
});
