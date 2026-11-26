import { HTTPError, type HTTPReq } from "./types";

const CRLF = Buffer.from("\r\n");
const SP = 0x20;
const COLON = 0x3a;
// const OWS = Buffer.from(" \t");
const TOKEN_CHARS = new Uint8Array(128);
for (const ch of "!#$%&'*+-.^_`|~0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz") {
  TOKEN_CHARS[ch.charCodeAt(0)] = 1;
}

function splitLines(buf: Buffer): Buffer[] {
  const delimLen = Buffer.byteLength(CRLF);
  if (delimLen === 0) return [buf];

  let start = 0;
  const parts: Buffer[] = [];
  let index;

  while ((index = buf.indexOf(CRLF, start)) !== -1) {
    parts.push(buf.subarray(start, index));
    start = index + delimLen;
  }

  parts.push(buf.subarray(start));
  return parts;
}

function parseRequestLine(line: Buffer): [string, Buffer, string] {
  const firstSpace = line.indexOf(SP);
  if (firstSpace <= 0) {
    throw new HTTPError(400, "bad request line");
  }

  const secondSpace = line.indexOf(SP, firstSpace + 1);
  if (secondSpace <= firstSpace + 1) {
    throw new HTTPError(400, "bad request line");
  }

  if (line.indexOf(SP, secondSpace + 1) !== -1) {
    throw new HTTPError(400, "bad request line");
  }

  const method = line.subarray(0, firstSpace);
  const uri = line.subarray(firstSpace + 1, secondSpace);
  const version = line.subarray(secondSpace + 1);

  return [method.toString("ascii"), uri, version.toString("ascii")];
}

function validateHeader(header: Buffer): boolean {
  const colonIndex = header.indexOf(COLON);
  if (colonIndex <= 0) {
    return false;
  }

  const fieldName = header.subarray(0, colonIndex);
  const fieldValue = header.subarray(colonIndex + 1);

  for (let i = 0; i < fieldName.length; i++) {
    const charCode = fieldName[i]!;
    if (charCode > 126 || TOKEN_CHARS[charCode] === 0) {
      return false;
    }
  }

  for (let i = 0; i < fieldValue.length; i++) {
    const charCode = fieldValue[i]!;
    if ((charCode < 32 && charCode !== 9) || charCode === 127) {
      return false;
    }
  }

  return true;
}

export function parseHTTPReq(data: Buffer): HTTPReq {
  const lines: Buffer[] = splitLines(data);
  const [method, uri, version] = parseRequestLine(lines[0]!);

  const headers: Buffer[] = [];
  for (let i = 1; i < lines.length; i++) {
    const h = Buffer.from(lines[i]!);
    if (h.length === 0) {
      break;
    }
    if (!validateHeader(h)) {
      throw new HTTPError(400, `bad field h${i}`);
    }
    headers.push(h);
  }

  console.assert(lines[lines.length - 1]!.length === 0);
  return {
    method,
    uri,
    version,
    headers,
  };
}

export function fieldGet(headers: Buffer[], key: string): null | Buffer {
  const keyLower = key.toLowerCase();
  for (const header of headers) {
    const colonIx = header.indexOf(COLON);
    if (colonIx <= 0) {
      continue;
    }

    const fieldName = header.subarray(0, colonIx);
    const fieldValue = header.subarray(colonIx + 1);
    const owsIx = fieldValue.indexOf(SP);
    const trimmed = owsIx !== -1 ? fieldValue.subarray(owsIx + 1) : fieldValue;
    if (fieldName.toString("ascii").toLowerCase() === keyLower) {
      return trimmed;
    }
  }
  return null;
};

export function parseDec(s: string) {
  if (s.length === 0) {
    throw new HTTPError(400, "bad decimal");
  }
  let num = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    if (ch < 48 || ch > 57) {
      throw new HTTPError(400, "bad decimal");
    }
    num = num * 10 + (ch - 48);
  }
  return num;
}