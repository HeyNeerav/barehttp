import * as net from "net";

type TCPConn = {
  socket: net.Socket;
  err: null | Error;
  ended: boolean;
  reader: null | {
    resolve: (value: Buffer) => void;
    reject: (reason: Error) => void;
  };
};

function soInit(socket: net.Socket): TCPConn {
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

function soRead(conn: TCPConn): Promise<Buffer> {
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

function soWrite(conn: TCPConn, data: Buffer): Promise<void> {
  console.assert(data.length > 0);

  return new Promise((resolve, reject) => {
    if (conn.err) {
      reject(conn.err);
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

type DynBuf = {
  data: Buffer;
  start: number;
  length: number;
};

function bufPush(buf: DynBuf, data: Buffer): void {
  const newLen = buf.length + data.length;
  const freeSpaceR = buf.data.length - (buf.start + buf.length);
  const freeSpace = buf.start + freeSpaceR;

  if (freeSpace >= data.length && data.length > freeSpaceR) {
    buf.data.copyWithin(0, buf.start, buf.start + buf.length);
    buf.start = 0;
  }

  if (buf.data.length < buf.start + newLen) {
    let cap = Math.max(buf.data.length, 32);

    while (cap < newLen) {
      cap *= 2;
    }

    const grown = Buffer.alloc(cap);
    buf.data.copy(grown, 0, buf.start, buf.start + buf.length);
    buf.data = grown;
    buf.start = 0;
  }

  data.copy(buf.data, buf.start + buf.length);
  buf.length = newLen;
}

function bufPop(buf: DynBuf, len: number): void {
  buf.start += len;
  buf.length -= len;

  if (buf.start >= buf.data.length / 2) {
    buf.data.copyWithin(0, buf.start, buf.start + buf.length);
    buf.start = 0;
  }
}

function cutMessage(buf: DynBuf): null | Buffer {
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

async function serveClient(conn: TCPConn): Promise<void> {
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

async function newConn(conn: TCPConn): Promise<void> {
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

type TCPListener = {
  server: net.Server;
  error: null | Error;
  sockets: net.Socket[];

  acceptor: null | {
    resolve: (value: TCPConn) => void;
    reject: (reason: Error) => void;
  };
};

function soListen(host: string, port: number): TCPListener {
  let server = net.createServer({
    pauseOnConnect: true,
  });

  const listener: TCPListener = {
    server,
    sockets: [],
    error: null,
    acceptor: null,
  };

  server.on("connection", (socket: net.Socket) => {
    if (listener.acceptor) {
      listener.acceptor.resolve(soInit(socket));
      listener.acceptor = null;
    } else {
      listener.sockets.push(socket);
    }
  });

  server.on("error", (err: Error) => {
    listener.error = err;
    if (listener.acceptor) {
      listener.acceptor.reject(err);
      listener.acceptor = null;
    }
  });

  server.listen({ host, port }, () => {
    console.log(`Server running on ${host}:${port}`);
  });

  return listener;
}

function soAccept(listener: TCPListener): Promise<TCPConn> {
  return new Promise((resolve, reject) => {
    if (listener.error) {
      reject(listener.error);
      return;
    }

    if (listener.sockets.length > 0) {
      const socket = listener.sockets.shift()!;
      resolve(soInit(socket));
      return;
    }

    if (listener.acceptor) {
      reject(new Error("Another accept is already pending"));
      return;
    }

    listener.acceptor = { resolve, reject };
  });
}

async function main() {
  const listener = soListen("127.0.0.1", 1234);

  while (true) {
    try {
      const conn = await soAccept(listener);
      newConn(conn);
    } catch (error) {
      console.error("Error accepting connection:", error);
      break;
    }
  }
}

main();
