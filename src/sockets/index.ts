import { Server, Socket } from 'socket.io';
import * as http from "http";
import { logger } from './logger';

export let io: Server | null = null;
export let counter = 0;
export const socketio = async (server: http.Server) => {
  try {
    // Socket communication
    io = new Server(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        credentials: false
      },
      pingInterval: 10000,
      pingTimeout: 2000
    });

    io.on("connection", (socket) => {
      console.log(" --> ADD SOCKET", counter);
      counter++;
      io && io.emit("connectionUpdated", counter);
      socket.on("disconnect", () => {
        console.log(" --> REMOVE SOCKET", counter);
        counter--;
        io && io.emit("connectionUpdated", counter);
      });
    });

    logger.info('  Socket server is running');
  } catch (err) {
    logger.error('  Socket server run failed');
    console.error(err);
  }
};
