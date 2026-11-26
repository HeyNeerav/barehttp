import { newConn } from "./http/server";
import { soAccept, soListen } from "./tcp/listener";

async function server() {
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

server();
