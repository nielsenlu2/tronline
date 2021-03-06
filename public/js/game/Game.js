({ define: typeof define === 'function'
            ? define
            : function (f) {
              module.exports = exports = f(function(file) {
                // This imitates the 'require' function for node js
                return require('../'+file);
              });
            }}).
define(function(require) {
  var Player = require('game/Player');
  var Game = function(width, height, players, isServerGame, callback) {
    this.width = width;
    this.height = height;
    this.players = players;
    this.running = true;
    this.isServerGame = isServerGame;
    var gameOverCallback = callback;
    var playerDiedCallback = null;

    var self = this;
    this.update = function() {
      if (!self.running)
        return;
      var paths = []
      for (var i in self.players) {
        paths.push(self.players[i].getPath());
      }
      for (var i in self.players) {
        var player = self.players[i];
        // concat effectively clones the point to avoid referencing the actual player
        var point = player.getHead().concat();
        // Move the point one square ahead in its direction before checking for a collision.
        // This is because if there is a collision one square ahead, then we won't move the
        // player afterwards
        if (player.getDirection() === 'N')
          point[1] -= 10;
        else if (player.getDirection() === 'E')
          point[0] += 10;
        else if (player.getDirection() === 'S')
          point[1] += 10;
        else if (player.getDirection() === 'W')
          point[0] -= 10;
        if (Game.isCollision(point, paths, width, height)) {
          if (player.active && playerDiedCallback)
            playerDiedCallback(i);
          if (self.isServerGame)
            player.active = false;
          else
            player.deactivate();
          var numActivePlayers = self.getNumActivePlayers();
          if ((numActivePlayers == 1 || numActivePlayers == 0) && gameOverCallback && !self.isServerGame) {
            for (var j in self.players)
              self.players[j].active = false;
            gameOverCallback();
            self.running = false;
          }
        }
        player.move(paths);
      }
    };

    this.getPlayers = function() {
      return self.players;
    };

    this.getNumActivePlayers = function() {
      var numActivePlayers = 0;
      for (var j in self.players)
        numActivePlayers += self.players[j].active;
      return numActivePlayers;
    };

    this.setGameOverCallback = function(callback) {
      gameOverCallback = callback;
    };

    this.setPlayerDiedCallback = function(callback) {
      playerDiedCallback = callback;
    };

    this.results = function() {
      var results = [];
      for (var i in self.players) {
        results.push({ nickname: self.players[i].nickname, score: self.players[i].calculateLength(),
                       alive: self.players[i].active });
      }
      results.sort(function(a, b) {
        if ((a.alive && b.alive) || (!a.alive && !b.alive))
          return b.score > a.score;
        else if (a.alive && !b.alive)
          return false;
        else
          return true;
      });

      return results;
    };
  };

  // Returns true if the point is about to collide with an array of paths or the border
  Game.isCollision = function(point, paths, width, height) {
    // Check that the point is not outside the window
    if (point[0] < 0 || point[0] > width || point[1] < 0 || point[1] > height)
      return true;

    // Look at every path
    for (var path in paths) {
      // Only go up to the second last one as we need to look at pairs of nodes
      for (var i = 0; i < paths[path].length-1; i++) {
        // Calculate the minimum and maximum y coords of the line
        var minY = paths[path][i][1],
            maxY = paths[path][i+1][1];
        if (paths[path][i+1][1] < paths[path][i][1]) {
          minY = maxY;
          maxY = paths[path][i][1];
        }

        // Calculate the minimum and maximum x coords of the line
        var minX = paths[path][i][0],
            maxX = paths[path][i+1][0];
        if (paths[path][i+1][0] < paths[path][i][0]) {
          minX = maxX;
          maxX = paths[path][i][0];
        }

        if (paths[path][i][0] === paths[path][i+1][0]) {
          // If the x coords are equal then it's a vertical line
          // If the point's x coord is equal to the x coord of the line and its
          // y coord is within the line's height (minimum y to maximum y) then it's a collision
          if (point[0] === paths[path][i][0] && point[1] >= minY && point[1] <= maxY)
            return true;
        } else {
          // Otherwise it's a horizontal line
          // If the point's y coord is equal to the y coord of the line and its
          // x coord is within the line's width (minimum x to maximum x) then it's a collision
          if (point[1] === paths[path][i][1] && point[0] >= minX && point[0] <= maxX)
            return true;
        }
      }
    }
    // If nothing found a collision, then it must not be a collision by default
    return false;
  };

  // This is used to create a new Game object with the same data as on the server.
  // It is needed as socket.io doesn't send functions contained within an object, only data.
  Game.createNewFromObject = function(obj) {
    var players = [];
    for (var i in obj.players) {
      players.push(Player.createNewFromObject(obj.players[i]));
    }
    var game = new Game(obj.width, obj.height, players);
    game.running = obj.running;
    game.isServerGame = obj.isServerGame;
    return game;
  };

  // This is used to clone a Game object to avoid passing by reference
  Game.clone = function(game) {
    return Game.createNewFromObject(game);
  };

  return Game;
});