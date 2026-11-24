export type BodyReader = {
  length: number;
  read: () => Promise<Buffer>;
};

export type HTTPReq = {
  method: string;
  uri: Buffer;
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
