import { soRead, type TCPConn } from "@/tcp/connection";
import { fieldGet, parseDec } from "./parser";
import { bufPop, bufPush, type DynBuf } from "@/buffer/dynamic-buffer";
import { HTTPError, type BodyReader, type HTTPReq } from "./types";

export function readerFromConnLength(
  conn: TCPConn, buf: DynBuf, remain: number
): BodyReader {
  return {
    length: remain,
    read: async (): Promise<Buffer> => {
      if (remain === 0) {
        return Buffer.from("");
      }
      if (buf.length === 0) {
        const data = await soRead(conn);
        bufPush(buf, data);
        if (data.length === 0) {
          throw new Error("unexpected EOF");
        }
      }

      const consume = Math.min(buf.length, remain);
      remain -= consume;
      const data = Buffer.from(buf.data.subarray(buf.start, buf.start + consume));
      bufPop(buf, consume);
      return data;
    }
  }
}

export function readerFromReq(conn: TCPConn, buf: DynBuf, req: HTTPReq) {
  let bodyLen = -1
  const contentLen = fieldGet(req.headers, "Content-Length");
  if (contentLen) {
    bodyLen = parseDec(contentLen.toString("latin1"))
    if (isNaN(bodyLen)) {
      throw new HTTPError(400, "bad Content-Length");
    }
  }

  const bodyAllowed = !(req.method === "GET" || req.method === "HEAD");
  const chunked = fieldGet(req.headers, "Transfer-Encoding")?.equals(Buffer.from("chunked")) || false

  if (!bodyAllowed && (bodyLen > 0 || chunked)) { 
    throw new HTTPError(400, "HTTP body not allowed");
  }

  if (!bodyAllowed) {
    bodyLen = 0;
  }

  if (bodyLen >= 0) {
    return readerFromConnLength(conn, buf, bodyLen);
  } else if (chunked) {
    throw new HTTPError(501, "TODO")
  } else {
    throw new HTTPError(501, "TODO")
  }
}