import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const API = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/+$/, "");
const getToken = () => localStorage.getItem("token") || sessionStorage.getItem("token");

let sharedSocket = null;
let sharedRefs = 0;

/**
 * Hook compartido para socket.io con auth JWT.
 * Singleton con ref-count: la conexión se reusa entre componentes y se cierra
 * cuando el último consumidor desmonta.
 */
export default function usePrivateSocket() {
  const [socket, setSocket] = useState(sharedSocket);
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    if (!sharedSocket) {
      sharedSocket = io(API, { auth: { token }, transports: ["websocket", "polling"] });
    }
    sharedRefs += 1;
    setSocket(sharedSocket);
    return () => {
      sharedRefs -= 1;
      if (sharedRefs <= 0 && sharedSocket) {
        sharedSocket.disconnect();
        sharedSocket = null;
      }
    };
  }, []);
  return socket;
}
