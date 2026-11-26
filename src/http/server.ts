import { createBufferedWriter, soRead, soWrite, type TCPConn } from "@/tcp/connection";
import { bufPop, bufPush, type DynBuf } from "@/buffer/dynamic-buffer";
import { HTTPError, type BodyReader, type HTTPReq, type HTTPRes } from "./types";
import { parseHTTPReq } from "./parser";
import { handleReq, readerFromMemory, readerFromReq } from "./request";
import { writeHTTPResp } from "./response";

const kMaxHeaderLen = 1024 * 8;

export function cutMessage(buf: DynBuf): null | HTTPReq {
  const idx = buf.data
    .subarray(buf.start, buf.start + buf.length)
    .indexOf("\r\n\r\n");

  if (idx < 0) {
    if (buf.length >= kMaxHeaderLen) {
      throw new HTTPError(413, "Header is too large");
    }
    return null;
  }

  const msg = parseHTTPReq(buf.data.subarray(buf.start, buf.start + idx + 4));
  bufPop(buf, idx + 4);
  return msg;
}

export async function serveClient(conn: TCPConn): Promise<void> {
  const { socket } = conn;
  const buf: DynBuf = {
    data: Buffer.alloc(0),
    length: 0,
    start: 0,
  };

  const writer = createBufferedWriter(conn);

  while (true) {
    const msg: null | HTTPReq = cutMessage(buf);

    if (!msg) {
      const data = await soRead(conn);
      bufPush(buf, data);

      if (data.length === 0) {
        console.log("end connection", socket.remoteAddress, socket.remotePort);
        if (buf.length === 0) { 
          return; // EOF
        }
        throw new HTTPError(400, "Unexpected EOF");
      }
      continue;
    }

    const reqBody: BodyReader = readerFromReq(conn, buf, msg);
    const res: HTTPRes = await handleReq(msg, reqBody);

    await writeHTTPResp(writer, res);

    if (msg.version === "1.0") {
      return;
    }

    while ( (await reqBody.read()).length > 0) {}
  }
}

export async function newConn(conn: TCPConn): Promise<void> {
  const { socket } = conn;
  console.log("new connection", socket.remoteAddress, socket.remotePort);

  try {
    await serveClient(conn);
  } catch (exc) {
    console.error("Error serving client:", exc);
    
    if (exc instanceof HTTPError) {
      const resp: HTTPRes = {
        code: exc.code,
        headers: [],
        body: readerFromMemory(Buffer.from(exc.message  + "\n")),
      };

      try {
        const writer = createBufferedWriter(conn);
        await writeHTTPResp(writer, resp);
      } catch (exc){}
      
    }
  } finally {
    socket.destroy();
  }
}
