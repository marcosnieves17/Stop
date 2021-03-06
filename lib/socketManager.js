var _ = require('lodash');
var scorer = require('./stop-score');

module.exports = function(dependencies) {
  var db = dependencies.db;
  var io = dependencies.io;

  return function mainHandler(socket) {
    socket.on('join', function(info, ack) {
      if (io.sockets.adapter.rooms[info.room] && io.sockets.adapter.rooms[info.room]['in-game']) {
        return ack('IN GAME ALREADY');
      }

      socket.join(info.room, function(err) {
        if (err) {
          console.log(err);
          return ack('ERROR');
        }

        ack('OK');

        socket.to(info.room).emit('new player', { name: info.name });

        socket.on('disconnect', function() {
          socket.to(info.room).emit('player left', { name: info.name });
        });

        socket.on('start', function(data) {
          io.sockets.adapter.rooms[info.room]['in-game'] = true;
          io.sockets.adapter.rooms[info.room].letter = data.letter;
          io.to(info.room).emit('start game', { letter: data.letter });
        });

        socket.on('end', function() {
          io.to(info.room).emit('send data');
        });

        socket.on('submission', function(data) {
          if (!(info.room in db)) {
            db[info.room] = [];
          }

          data.name = data.name || info.name;
          data.subs = data.data || data.subs;

          db[info.room].push(data);
          console.log(db[info.room]);

          if (db[info.room].length >= io.sockets.adapter.rooms[info.room]) {

            var results = scorer(db[info.room], io.sockets.adapter.rooms[info.room].letter);
            results = _.map(results, (ob) => { _.pick(obj, ['name', 'score']) });
            io.to(info.room).emit('results', results);
            delete db[info.room];
            delete io.sockets.adapter.rooms[info.room]['in-game'];
            delete io.sockets.adapter.rooms[info.room].letter;
          }
        });
      });
    });
  };
};
