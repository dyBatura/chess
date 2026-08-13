const WebSocket = require('ws');
const server = new WebSocket.Server({ port: process.env.PORT || 8080 });

let players = []; // Stores player objects: { socket, color }

server.on('connection', (socket) => {
  // Reject connection if room is already full
  if (players.length >= 2) {
    socket.send(JSON.stringify({ type: 'system', message: 'Room full' }));
    socket.close();
    return;
  }

  // Determine which color is currently missing in the room
  const hasWhite = players.some(p => p.color === 'w');
  const assignedColor = hasWhite ? 'b' : 'w';

  // Store the socket connection along with its assigned color
  players.push({ socket, color: assignedColor });
  
  socket.send(JSON.stringify({ type: 'init', color: assignedColor }));
  // If we now have exactly 2 players, notify both to start
  if (players.length === 2) {
    players.forEach(p => p.socket.send(JSON.stringify({ type: 'start' })));
  }

  // Listen for moves and forward them to the opponent
  socket.on('message', (message) => {
    players.forEach(p => {
      if (p.socket !== socket && p.socket.readyState === WebSocket.OPEN) {
        p.socket.send(message.toString());
      }
    });
  });

  // Handle disconnection
  socket.on('close', () => {
    console.log("--- Connection Closed ---");
    players = players.filter(p => p.socket !== socket);
    console.log("Active players remaining in room:", players.length);
    
    players.forEach(p => {
      console.log("Sending 'pause' command to remaining player...");
      p.socket.send(JSON.stringify({ type: 'pause' }));
    });
  });
});

console.log('Multiplayer server running on port 8080');