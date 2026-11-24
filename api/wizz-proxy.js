import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";

const backendOrigin = () => process.env.WIZZ_BACKEND_ORIGIN
    || parseEnv(readFileSync(new URL("../.env", import.meta.url), "utf8")).WIZZ_BACKEND_ORIGIN;

const readRoutes = new Set(["/api/v1/auth/me", "/api/v1/wizz/me", "/api/v1/wizz/conversations"]);
const authWrites = new Set(["/api/v1/auth/company/login", "/api/v1/auth/logout"]);
const proposalPath = /^\/api\/v1\/wizz\/proposals\/([a-f\d]{24})\/(answer|chat|pricing|write|google-doc)$/;
const proposalMethods = { answer: "PATCH", chat: "POST", pricing: "GET", write: "POST", "google-doc": "POST" };

async function handler(request) {
    const url = new URL(request.url);
    const routedPath = url.searchParams.getAll("__wizz_path");
    const pathname = url.pathname === "/api/wizz-proxy"
        ? (routedPath.length === 1 ? `/api/v1/${routedPath[0]}` : "")
        : url.pathname;
    url.searchParams.delete("__wizz_path");
    const search = url.search;
    const method = request.method;
    const isFile = /^\/api\/v1\/wizz\/public\/file\/[\w.-]+$/.test(pathname);
    const proposalAction = proposalPath.exec(pathname)?.[2];
    const allowed = (method === "GET" && readRoutes.has(pathname))
        || (method === "POST" && authWrites.has(pathname))
        || (method === "POST" && pathname === "/api/v1/wizz/chat")
        || (["GET", "DELETE"].includes(method) && /^\/api\/v1\/wizz\/conversations\/[a-f\d]{24}$/.test(pathname))
        || (["GET", "HEAD"].includes(method) && isFile)
        || (["GET", "POST"].includes(method) && pathname === "/api/v1/wizz/proposals")
        || (proposalAction && proposalMethods[proposalAction] === method);
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
            body: ["POST", "PATCH"].includes(method) ? await request.arrayBuffer() : undefined,
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
