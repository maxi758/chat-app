const path = require('path');
const http = require('http');
const express = require('express');
const socketio = require('socket.io');
const Filter = require('bad-words');
const {
  generateMessage,
  generateLocationMessage,
} = require('./utils/messages');
const {
  addUser,
  removeUser,
  getUser,
  getUsersInRoom,
} = require('./utils/users');

const app = express();
const server = http.createServer(app);
const io = socketio(server); // socketio expects to be called with raw http server

const port = process.env.PORT || 3000;
const publicDirectoryPath = path.join(__dirname, '../public');

app.use(express.static(publicDirectoryPath));
//app.use(express.json());

//let count = 0;

io.on('connection', (socket) => {
  // socket is an object that contains information about the new connection
  console.log('New WebSocket connection');

  // socket.emit('countUpdated', count); // emit to specific client

  // socket.on('increment', () => { // receive from client
  //     count++;
  //     // socket.emit('countUpdated', count); // emit to specific client
  //     io.emit('countUpdated', count); // emit to all clients
  // });

  //socket.emit('message',generateMessage('Welcome')); // emit to specific client
  //socket.broadcast.emit('message', generateMessage('A new user has joined!')); // emit to all clients except the one that sent the message

  socket.on('join', (options, callback) => {
    const { error, user } = addUser({ id: socket.id, ...options });

    if (error) {
      return callback(error);
    }

    socket.join(user.room);

    socket.emit('message', generateMessage('Welcome', 'Admin')); // emit to specific client
    socket.broadcast
      .to(user.room)
      .emit(
        'message',
        generateMessage(`${user.username} has joined!`, 'Admin')
      ); // emit to all clients except the one that sent the message
    
    io.to(user.room).emit('roomData', {
      room: user.room,
      users: getUsersInRoom(user.room),
    });

    callback();
  });

  socket.on('sendMessage', (message, callback) => {
    const user = getUser(socket.id);
    // receive from client
    const filter = new Filter();
    if (filter.isProfane(message)) {
      return callback('Profanity is not allowed!');
    }
    io.to(user.room).emit('message', generateMessage(message, user.username));
    callback('Delivered!'); // send acknowledgement back to client
  });

  socket.on('sendLocation', (coords, callback) => {
    const user = getUser(socket.id);
    console.log(user);
    io.to(user.room).emit(
      'locationMessage',
      generateLocationMessage(
        `https://google.com/maps?q=${coords.latitude},${coords.longitude}`,
        user.username
      )
    );
    callback();
  });

  socket.on('disconnect', () => {
    const user = removeUser(socket.id);

    if (user) {
      io.to(user.room).emit(
        'message',
        generateMessage(`${user.username} has left!`, 'Admin')
      );

      io.to(user.room).emit('roomData', {
        room: user.room,
        users: getUsersInRoom(user.room),
      }); // emit to all clients
    }
  });
});

server.listen(port, () => {
  console.log(`Server is up on port ${port}!`);
});
