import { Application, Router, send } from "https://deno.land/x/oak@v12.6.0/mod.ts";
const HOSTNAME = Deno.env.get("HOSTNAME") || "localhost";
const port = Deno.env.get("PORT") || 3000;
const protocol = (HOSTNAME === "localhost") ? "ws" : "wss";
const WS_URL = `${protocol}://${HOSTNAME}${(HOSTNAME === "localhost") ? `:${port}` : ""}`;

class Room {
  constructor(id) {
    this.id = id;
    this.connectedClients = new Map();
    this.userCursors = new Map();
    this.cursorColors = new Map();
    this.messages = [];
    this.userBuzzerCooldowns = new Map();
  }

  broadcast(message) {
    for (const [connectionKey, client] of this.connectedClients.entries()) {
      if (client.readyState !== WebSocket.OPEN) {
        this.connectedClients.delete(connectionKey);
        this.userCursors.delete(connectionKey);
        continue;
      }
      client.send(message);
    }
  }  

  addMessage(message) {
    this.messages.push(message);
  }

  broadcast_usernames() {
    const users = [...this.connectedClients.entries()].map(([connectionKey, client]) => ({
      username: client.username,
      cursorColor: this.cursorColors.get(connectionKey),
    }));
    this.broadcast(
      JSON.stringify({
        event: "update-users",
        users: users,
      }),
    );
  }

  broadcast_cursors() {
    const activeCursors = Array.from(this.userCursors.entries()).map(([connectionKey, cursorData]) => ({
      connectionKey,
      username: cursorData.username,
      cursor: cursorData.cursor,
      cursorColor: this.cursorColors.get(connectionKey),
    }));
    this.broadcast(
      JSON.stringify({
        event: "update-cursors",
        cursors: activeCursors,
      }),
    );
  }  

  updateCursor(connectionKey, cursorPosition, cursorColor) {
    const username = this.connectedClients.get(connectionKey).username;
    this.userCursors.set(connectionKey, { cursor: cursorPosition, username });
    this.cursorColors.set(connectionKey, cursorColor);
  }
}

const rooms = new Map();
const app = new Application();
const router = new Router();

router
  .get("/", async (context) => {
    await send(context, context.request.url.pathname, {
      root: `${Deno.cwd()}/views`,
      index: "index.html",
    });
  })
  .get("/config", (context) => {
    context.response.body = { wsUrl: WS_URL };
  })
  .post("/create_room", (context) => {
    let roomId;
    do {
      roomId = (Math.random() * 10000000).toFixed(0);
    } while (rooms.has(roomId));
    
    const room = new Room(roomId);
    rooms.set(roomId, room);
    context.response.body = { roomId };
  })
  .post("/validate_room", async (context) => {
    const { roomId } = await context.request.body().value;
    const roomExists = rooms.has(roomId);
    context.response.body = { roomExists };
  })
  .get("/start_web_socket", async (context) => {
    const socket = await context.upgrade();
    
    socket.onmessage = (m) => {
      const data = JSON.parse(m.data);
    
      if (data.event === 'join-room') {
        const { username, roomId, cursorColor } = data;
        const room = rooms.get(roomId);
        if (!room) {
          // Handle error: room not found
          socket.close();
          return;
        }
    
        socket.roomId = roomId; // Save the roomId on the socket
    
        let connectionKey = username;
        let identifier = 1;
        while (room.connectedClients.has(connectionKey)) {
          connectionKey = `${username}-${identifier}`;
          identifier++;
        }
    
        socket.username = username;
        socket.cursorColor = cursorColor; // Store cursorColor on the socket
        room.connectedClients.set(connectionKey, socket);
        room.cursorColors.set(connectionKey, cursorColor); // Update the cursor color in the room
        room.broadcast_usernames(); // Broadcast updated users
    
        socket.connectionKey = connectionKey;
    
        socket.send(JSON.stringify({
          event: "joined-room",
          connectionKey: connectionKey,
          chatHistory: room.messages, // Send the entire chat history
        }));
    
        const joinMessage = {
          event: "send-message",
          isSystem: true,
          cursorColor: socket.cursorColor,
          message: `${socket.username} has joined the room.`,
        };
        
        room.addMessage(joinMessage); // Store the system message in the room
        room.broadcast(JSON.stringify(joinMessage));
        room.broadcast_cursors();
        
        return;
      }
    
      const roomId = socket.roomId; // Retrieve the roomId from the socket
      const room = rooms.get(roomId); // Get the room using the roomId
      if (!room || !socket.username) {
        return;
      }

      switch (data.event) {
        case "send-message": {
          if (data.message && data.message !== "" && data.message.length <= 560) {
            const messageData = {
              event: "send-message",
              username: socket.username,
              cursorColor: socket.cursorColor,
              message: data.message,
            };
            room.addMessage(messageData); // Store the message in the room
            room.broadcast(JSON.stringify(messageData));
          }
          break;
        }
        case "send-cursor":
          room.updateCursor(socket.connectionKey, data.cursor, socket.cursorColor); // Use socket.connectionKey
          room.broadcast_cursors();
          break;
        case "update-cursors":
          userCursors.clear();
          for (const { connectionKey, cursor, cursorColor } of data.cursors) {
            userCursors.set(connectionKey, { cursor, cursorColor });
          }
          updateCursors(userCursors);
          break;
        case "buzzer-clicked": {
          const connectionKey = socket.connectionKey;
          const lastClicked = room.userBuzzerCooldowns.get(connectionKey) || 0;
        
          const currentTime = Date.now();
          const cooldownTime = 4 * 1000;
        
          if (currentTime - lastClicked < cooldownTime) {
            return;
          }
        
          room.userBuzzerCooldowns.set(connectionKey, currentTime);
        
          const buzzerMessage = {
            event: "send-message",
            isSystem: true,
            cursorColor: socket.cursorColor,
            message: `${socket.username} has clicked the buzzer!`,
          };
          room.addMessage(buzzerMessage);
          room.broadcast(JSON.stringify(buzzerMessage));
          break;
        }
      }
    };

    socket.onclose = () => {
      const roomId = socket.roomId; // Retrieve the roomId from the socket
      const room = rooms.get(roomId); // Get the room using the roomId
    
      if (room) {
        const connectionKey = [...room.connectedClients.entries()]
          .find(([_, client]) => client === socket)[0];
        room.connectedClients.delete(connectionKey);
        room.userCursors.delete(connectionKey); // Delete the cursor entry
    
        room.broadcast_usernames(); // Broadcast updated users
        room.broadcast_cursors(); // Broadcast updated cursors
    
        const leaveMessage = {
          event: "send-message",
          isSystem: true,
          cursorColor: room.cursorColors.get(connectionKey), // Get the color of the person leaving
          message: `${socket.username} has left the room.`,
        };
        
        room.addMessage(leaveMessage); // Store the system message in the room
        room.broadcast(JSON.stringify(leaveMessage));      
      }
    };  
});

app.use((context, next) => {
  context.response.headers.set("Content-Security-Policy", `default-src 'self'; connect-src 'self' ${WS_URL}`);
  return next();
});

app.use(router.routes());
app.use(router.allowedMethods());
app.use(async (context) => {
  await send(context, context.request.url.pathname, {
    root: `${Deno.cwd()}/public`,
  });
});
app.listen({ port });
if (HOSTNAME === "localhost") {
  console.log(`Listening on http://localhost:${port}`);
} else {
  console.log(`Listening on ${HOSTNAME}`);
}