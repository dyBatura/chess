const WebSocket = require('ws');
const server = new WebSocket.Server({ port: process.env.PORT || 8080 });

let players = [];

server.on('connection', (socket) => {
  // Only allow up to 2 players in the room
  if (players.length >= 2) {
    socket.send(JSON.stringify({ type: 'system', message: 'Room full' }));
    socket.close();
    return;
  }

  players.push(socket);
  
  // First connected is White, second is Black
  const assignedColor = players.length === 1 ? 'w' : 'b';
  socket.send(JSON.stringify({ type: 'init', color: assignedColor }));

  // Listen for moves from one player and forward to the other
  socket.on('message', (message) => {
    players.forEach(client => {
      if (client !== socket && client.readyState === WebSocket.OPEN) {
        client.send(message.toString());
      }
    });
  });

  // Handle disconnection
  socket.on('close', () => {
    players = players.filter(client => client !== socket);
  });
});

console.log('Multiplayer server running on port 8080');