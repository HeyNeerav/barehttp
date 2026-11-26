import { soWrite, type TCPConn } from "@/tcp/connection";
import { fieldGet } from "./parser";
import type { HTTPRes } from "./types";

function statusText(code: number): string {
  switch (code) {
    case 200: return "OK";
    case 400: return "Bad Request";
    case 404: return "Not Found";
    case 500: return "Internal Server Error";
    default: return "Unknown";
  }
}

export function encodeHTTPResp(resp: HTTPRes): Buffer {
  const headers = resp.headers.map(h => h.toString("latin1")).join("\r\n");
  const statusLine = `HTTP/1.1 ${resp.code} ${statusText(resp.code)}\r\n`;
  const headerSection = headers.length > 0 ? headers + "\r\n" : "";
  return Buffer.from(statusLine + headerSection + "\r\n", "latin1");
}

export async function writeHTTPResp(conn: TCPConn, resp: HTTPRes): Promise<void> { 
  if (resp.body.length < 0) { 
    throw new Error("TODO: chunked encoding");
  }

  console.assert(!fieldGet(resp.headers, "Content-Length"));
  resp.headers.push(Buffer.from(`Content-Length: ${resp.body.length}`));

  await soWrite(conn, encodeHTTPResp(resp));

  while (true) {
    const data = await resp.body.read();
    if (data.length === 0) {
      break;
    }
    await soWrite(conn, data);
  }
}