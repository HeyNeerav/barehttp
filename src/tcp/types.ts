import * as net from "net";

export type TCPListener = {
  server: net.Server;
  error: null | Error;
  sockets: net.Socket[];

  acceptor: null | {
    resolve: (value: TCPConn) => void;
    reject: (reason: Error) => void;
  };
};

export type TCPConn = {
  socket: net.Socket;
  err: null | Error;
  ended: boolean;
  reader: null | {
    resolve: (value: Buffer) => void;
    reject: (reason: Error) => void;
  };
};

export type BufferedWriter = {
  write: (data: Buffer) => Promise<void>,
  flush: () => Promise<void>,
  available: () => number,
  getBuffer: () => Buffer,
  advance: (n: number) => void,
};