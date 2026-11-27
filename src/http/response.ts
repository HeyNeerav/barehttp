import { fieldGet } from "./parser";
import type { HTTPRes } from "./types";
import { HTTPError } from "./HTTPError";

import type { BufferedWriter } from "@/tcp/types";

function statusText(code: number): string {
  switch (code) {
    case 200:
      return "OK";
    case 400:
      return "Bad Request";
    case 404:
      return "Not Found";
    case 413:
      return "Payload Too Large";
    case 500:
      return "Internal Server Error";
    case 501:
      return "Not Implemented";
    default:
      return "Unknown";
  }
}

function calculateRespLen(resp: HTTPRes): number {
  let len = 0;
  len += Buffer.byteLength(`HTTP/1.1 ${resp.code} ${statusText(resp.code)}\r\n`);

  for (const header of resp.headers) {
    len += header.length + 2;
  }

  len += 2;
  return len;
}

export function encodeHTTPResp(resp: HTTPRes, buf: Buffer): number {
  let pos = 0;
  const statusLine = `HTTP/1.1 ${resp.code} ${statusText(resp.code)}\r\n`;
  
  pos += buf.write(statusLine, pos, "latin1");
  for (const header of resp.headers) {
    header.copy(buf, pos);
    pos += header.length;
    buf[pos++] = 0x0d; // CR \r
    buf[pos++] = 0x0a; // LF \n
  }


  buf[pos++] = 0x0d;
  buf[pos++] = 0x0a;

  return pos;
}

export async function writeHTTPResp(
  writer: BufferedWriter,
  resp: HTTPRes,
): Promise<void> {
  if (resp.body.length < 0) {
    throw new HTTPError(501, "TODO: chunked encoding");
  }

  console.assert(!fieldGet(resp.headers, "Content-Length"));
  resp.headers.push(Buffer.from(`Content-Length: ${resp.body.length}`));

  const headerLen = calculateRespLen(resp);
  if (writer.available() < headerLen) {
    await writer.flush();
  }

  if (writer.available() >= headerLen) {
    const buf = writer.getBuffer();
    const written = encodeHTTPResp(resp, buf);
    writer.advance(written);
  } else {
    const fallbackBuf = Buffer.alloc(headerLen);
    const written = encodeHTTPResp(resp, fallbackBuf);
    console.assert(written === headerLen);
    await writer.write(fallbackBuf);
  }

  while (true) {
    const data = await resp.body.read();
    if (data.length === 0) {
      break;
    }
    await writer.write(data);
  }

  await writer.flush();
}
