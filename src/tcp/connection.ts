import * as net from "net";
import type { BufferedWriter, TCPConn } from "./types";

export function soInit(socket: net.Socket): TCPConn {
  const conn: TCPConn = {
    socket: socket,
    err: null,
    ended: false,
    reader: null,
  };

  socket.on("data", (data: Buffer) => {
    console.assert(conn.reader !== null);
    conn.socket.pause();
    conn.reader!.resolve(data);
    conn.reader = null;
  });

  socket.on("end", () => {
    conn.ended = true;
    if (conn.reader) {
      conn.reader.resolve(Buffer.from("")); // EOF
      conn.reader = null;
    }
  });

  socket.on("error", (err: Error) => {
    conn.err = err;
    if (conn.reader) {
      conn.reader.reject(err);
      conn.reader = null;
    }
  });

  return conn;
}

export function soRead(conn: TCPConn): Promise<Buffer> {
  console.assert(!conn.reader);

  return new Promise((resolve, reject) => {
    if (conn.err) {
      reject(conn.err);
      return;
    }

    if (conn.ended) {
      resolve(Buffer.from("")); // EOF
      return;
    }

    conn.reader = { resolve, reject };
    conn.socket.resume();
  });
}

export function soWrite(conn: TCPConn, data: Buffer): Promise<void> {
  console.assert(data.length > 0);

  return new Promise((resolve, reject) => {
    if (conn.err) {
      reject(conn.err);
      return;
    }

    if (conn.ended) {
      reject(new Error("connection ended"));
      return;
    }

    conn.socket.write(data, (err?: Error | null) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

const cap = 1024 * 4 // 4KB;

export function createBufferedWriter(conn: TCPConn): BufferedWriter {
  const buf = Buffer.alloc(cap);
  let offset = 0;

  async function flush() {
    if (offset > 0) {
      await soWrite(conn, buf.subarray(0, offset));
      offset = 0;
    }
  }

  async function write(data: Buffer) {
    if (offset + data.length > cap) {
      await flush();
    }

    if (data.length > cap) {
      await soWrite(conn, data);
      return;
    }

    data.copy(buf, offset);
    offset += data.length;
  }

  return {write, flush}
};
