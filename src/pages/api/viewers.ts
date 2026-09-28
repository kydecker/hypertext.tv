import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ request }) => {
  const ViewerCountNamespace = env.VIEWER_COUNT;

  if (!ViewerCountNamespace) {
    return new Response("Durable Object not available", { status: 500 });
  }

  // Check for WebSocket upgrade before forwarding to Durable Object
  if (request.headers.get("Upgrade") !== "websocket") {
    return new Response("Expected Upgrade: websocket", { status: 426 });
  }

  // Get the Durable Object instance (single global instance for all viewers)
  const id = ViewerCountNamespace.idFromName("global");
  const stub = ViewerCountNamespace.get(id);

  // Forward the request to the Durable Object
  return stub.fetch(request);
};
