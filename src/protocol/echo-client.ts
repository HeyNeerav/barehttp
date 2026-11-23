import { soRead, soWrite, type TCPConn } from "@/tcp/connection";
import { bufPop, bufPush, type DynBuf } from "@/buffer/dynamic-buffer";

export function cutMessage(buf: DynBuf): null | Buffer {
  const idx = buf.data
    .subarray(buf.start, buf.start + buf.length)
    .indexOf("\n");

  if (idx < 0) {
    return null;
  }

  const msg = Buffer.from(buf.data.subarray(buf.start, buf.start + idx + 1));
  bufPop(buf, idx + 1);
  return msg;
}

export async function serveClient(conn: TCPConn): Promise<void> {
  const { socket } = conn;
  const buf: DynBuf = {
    data: Buffer.alloc(0),
    length: 0,
    start: 0,
  };
  while (true) {
    const msg: null | Buffer = cutMessage(buf);

    if (!msg) {
      const data = await soRead(conn);
      bufPush(buf, data);

      if (data.length === 0) {
        console.log("end connection");
        return;
      }
      continue;
    }

    if (msg.equals(Buffer.from("quit\n"))) {
      await soWrite(conn, Buffer.from("Bye. \n"));
      socket.destroy();
      return;
    } else {
      const reply = Buffer.concat([Buffer.from("Echo: "), msg]);
      await soWrite(conn, reply);
    }
  }
}

export async function newConn(conn: TCPConn): Promise<void> {
  const { socket } = conn;
  console.log("new connection", socket.remoteAddress, socket.remotePort);

  try {
    await serveClient(conn);
  } catch (exc) {
    console.error("Error serving client:", exc);
  } finally {
    socket.destroy();
  }
}
