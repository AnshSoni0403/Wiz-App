import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const backendOrigin = () => process.env.WIZZ_BACKEND_ORIGIN
    || parseEnv(readFileSync(new URL("../.env", import.meta.url), "utf8")).WIZZ_BACKEND_ORIGIN;

const readRoutes = new Set(["/api/v1/auth/me", "/api/v1/wizz/me", "/api/v1/wizz/conversations"]);
const authWrites = new Set(["/api/v1/auth/company/login", "/api/v1/auth/logout"]);
const proposalPath = /^\/api\/v1\/wizz\/proposals\/([a-f\d]{24})\/(answer|chat|pricing|write|google-doc)$/;
const proposalMethods = { answer: "PATCH", chat: "POST", pricing: "GET", write: "POST", "google-doc": "POST" };
// Research is started by the chat itself; the PWA only follows a run's progress.
const researchRunPath = /^\/api\/v1\/wizz\/research\/runs\/[a-f\d]{24}$/;

// Task Agent and notification inbox (marwizvision-v2-server/docs/task-agent-api.md): exactly the
// routes the PWA calls, each with its methods. The backend checks who may see or change each task.
const ID = "[a-f\\d]{24}";
const route = (methods, pattern) => ({ methods, re: new RegExp(`^/api/v1/${pattern}$`) });
const taskRoutes = [
    route(["GET", "POST"], "tasks"),
    route(["GET"], "tasks/(access|directory|summary|workload|teams)"),
    route(["GET", "PUT"], `tasks/${ID}`),
    route(["PUT"], `tasks/${ID}/(status|follow-up)`),
    route(["POST"], `tasks/${ID}/(review|comments|checklist|attachments|watch)`),
    route(["PATCH", "DELETE"], `tasks/${ID}/checklist/${ID}`),
    route(["DELETE"], `tasks/${ID}/attachments/${ID}`),
    route(["GET"], "notifications"),
    route(["GET"], "notifications/(unread-count|push/config)"),
    route(["POST"], "notifications/(read-all|push/subscribe|push/unsubscribe)"),
    route(["POST"], `notifications/${ID}/read`),
    route(["PATCH"], `wizz/tasks/actions/${ID}`),
    route(["POST"], `wizz/tasks/actions/${ID}/(confirm|cancel)`),
];
// Evidence downloads are files (images, PDFs, ...), not JSON.
const taskAttachmentPath = new RegExp(`^/api/v1/tasks/${ID}/attachments/${ID}$`);

async function handler(request) {
    const url = new URL(request.url);
    const routedPath = url.searchParams.getAll("__wizz_path");
    const pathname = url.pathname === "/api/wizz-proxy"
        ? (routedPath.length === 1 ? `/api/v1/${routedPath[0]}` : "")
        : url.pathname;
    url.searchParams.delete("__wizz_path");
    const search = url.search;
    const method = request.method;
    const isAttachment = ["GET", "HEAD"].includes(method) && taskAttachmentPath.test(pathname);
    const isFile = /^\/api\/v1\/wizz\/public\/file\/[\w.-]+$/.test(pathname) || isAttachment;
    const proposalAction = proposalPath.exec(pathname)?.[2];
    const allowed = (method === "GET" && readRoutes.has(pathname))
        || isAttachment
        || taskRoutes.some((r) => r.methods.includes(method) && r.re.test(pathname))
        || (method === "POST" && authWrites.has(pathname))
        || (method === "POST" && pathname === "/api/v1/wizz/chat")
        || (["GET", "DELETE"].includes(method) && /^\/api\/v1\/wizz\/conversations\/[a-f\d]{24}$/.test(pathname))
        || (["GET", "HEAD"].includes(method) && isFile)
        || (["GET", "POST"].includes(method) && pathname === "/api/v1/wizz/proposals")
        || (proposalAction && proposalMethods[proposalAction] === method)
        || (method === "GET" && researchRunPath.test(pathname));
    if (!allowed) return new Response(null, { status: 404 });

    let origin;
    try {
        origin = new URL(backendOrigin());
        if (origin.protocol !== "https:" || origin.username || origin.password
            || origin.pathname !== "/" || origin.search || origin.hash
            || origin.origin === new URL(request.url).origin) throw new Error();
    } catch {
        return Response.json({ message: "Wizz backend is not configured." }, { status: 503 });
    }

    const headers = new Headers();
    for (const name of ["cookie", "content-type", "accept", "range"]) {
        if (request.headers.has(name)) headers.set(name, request.headers.get(name));
    }
    // Preserve the browser origin check before presenting the request to the API as same-origin.
    const browserOrigin = request.headers.get("origin");
    if (browserOrigin && browserOrigin !== new URL(request.url).origin) {
        return new Response(null, { status: 403 });
    }
    if (browserOrigin) headers.set("origin", origin.origin);

    try {
        const upstream = await fetch(new URL(pathname + search, origin), {
            method,
            headers,
            body: ["POST", "PATCH", "PUT"].includes(method) ? await request.arrayBuffer() : undefined,
            redirect: "manual",
            signal: AbortSignal.timeout(110000),
        });
        const contentType = upstream.headers.get("content-type") || "";
        if ((!isFile && ![204, 304].includes(upstream.status) && !/^application\/json\b/i.test(contentType))
            || (isFile && /^(text\/html|image\/svg\+xml|application\/xhtml\+xml)\b/i.test(contentType))) {
            await upstream.body?.cancel();
            return Response.json({ message: "The configured backend did not return a supported Wizz API response." }, { status: 502 });
        }
        const responseHeaders = new Headers({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
        for (const name of ["content-type", "content-disposition", "accept-ranges", "content-range"]) {
            if (upstream.headers.has(name)) responseHeaders.set(name, upstream.headers.get(name));
        }
        for (const cookie of upstream.headers.getSetCookie()) {
            // The browser stores the session on the Vercel app host.
            responseHeaders.append("set-cookie", cookie.replace(/;\s*Domain=[^;]*/gi, ""));
        }
        const location = upstream.headers.get("location");
        if (location) {
            const destination = new URL(location, origin);
            if (destination.protocol === "https:") {
                responseHeaders.set("location", destination.origin === origin.origin
                    ? destination.pathname + destination.search : destination.href);
            }
        }
        return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
    } catch {
        return Response.json({ message: "Wizz backend is temporarily unavailable." }, { status: 502 });
    }
}

export default { fetch: handler };
