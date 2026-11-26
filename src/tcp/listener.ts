import * as net from "net";
import { soInit, type TCPConn } from "./connection";

export type TCPListener = {
  server: net.Server;
  error: null | Error;
  sockets: net.Socket[];

  acceptor: null | {
    resolve: (value: TCPConn) => void;
    reject: (reason: Error) => void;
  };
};

export function soListen(host: string, port: number): TCPListener {
  let server = net.createServer({
    pauseOnConnect: true,
    noDelay: true,
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

export function soAccept(listener: TCPListener): Promise<TCPConn> {
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
