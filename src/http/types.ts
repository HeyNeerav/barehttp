export type BodyReader = {
  length: number;
  read: () => Promise<Buffer>;
};

export type BufferedWriter = {
  write: (data: Buffer) => Promise<void>,
  flush: () => Promise<void>,
  // ...
};

export type HTTPReq = {
  method: string;
  uri: string;
  version: string;
  headers: Buffer[];
};

export type HTTPRes = {
  code: number;
  headers: Buffer[];
  body: BodyReader;
};

export class HTTPError extends Error {
  code: number;

  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}
