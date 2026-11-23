export type DynBuf = {
  data: Buffer;
  start: number;
  length: number;
};

export function bufPush(buf: DynBuf, data: Buffer): void {
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

export function bufPop(buf: DynBuf, len: number): void {
  buf.start += len;
  buf.length -= len;

  if (buf.start >= buf.data.length / 2) {
    buf.data.copyWithin(0, buf.start, buf.start + buf.length);
    buf.start = 0;
  }
}
