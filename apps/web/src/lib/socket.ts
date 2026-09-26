import { io, type Socket } from 'socket.io-client';
import { useAuth } from '../stores/auth';
import { SOCKET_URL } from './env';

let socket: Socket | null = null;
let tokenInUse: string | null = null;

/**
 * One shared connection per signed-in session. The access token is sent in the handshake;
 * when it rotates the socket reconnects with the new one.
 */
export function getSocket(): Socket | null {
  const token = useAuth.getState().accessToken;
  if (!token) {
    disconnectSocket();
    return null;
  }
  if (socket && tokenInUse === token) return socket;
  socket?.disconnect();
  tokenInUse = token;
  socket = io(SOCKET_URL ?? '/', {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionDelayMax: 8000,
  });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
  tokenInUse = null;
}
