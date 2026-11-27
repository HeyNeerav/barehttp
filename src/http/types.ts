export type BodyReader = {
  length: number;
  read: () => Promise<Buffer>;
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