import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxyRequest(request, path);
}

async function proxyRequest(request: NextRequest, path: string[]) {
  const backendBaseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const targetPath = path.join("/");
  const queryString = request.nextUrl.search;
  
  // If the path is 'health', call root /health, otherwise call /api/...
  const url = targetPath === "health" 
    ? `${backendBaseUrl}/health${queryString}` 
    : `${backendBaseUrl}/api/${targetPath}${queryString}`;

  const headers = new Headers(request.headers);
  // Important: Remove host so fetch sets it correctly for the backend
  headers.delete("host");

  try {
    const body = request.method !== "GET" && request.method !== "HEAD" 
      ? await request.arrayBuffer() 
      : undefined;

    const response = await fetch(url, {
      method: request.method,
      headers: headers,
      body: body,
      cache: "no-store",
    });

    const responseData = await response.arrayBuffer();
    
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      // Don't forward transfer-encoding, content-encoding as Next handles those
      if (!["transfer-encoding", "content-encoding", "content-length"].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    return new NextResponse(responseData, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json({ detail: "Backend proxy error" }, { status: 502 });
  }
}
