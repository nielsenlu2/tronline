define(function(require) {
  var $              = require('jquery'),
      _              = require('underscore'),
      Backbone       = require('backbone'),
      eventBus       = require('eventBus'),
      Player         = require('game/Player'),
      template       = require('text!create/multiplayerSetup.html'),
      playerTmpl     = require('text!create/player.html'),
      difficultyTmpl = require('text!create/difficulty.html');

  var self;
  var MultiplayerSetupView = Backbone.View.extend({
    events: {
      'change td#difficulty select': 'changeDifficulty',
      'click a#what-is-difficulty': 'showDifficultyModal',
      'click div.difficultyModal span': 'closeDifficultyModal',
      'click table#colorSelection span': 'clickColor',
      'click button[name="createGame"]': 'clickStart'
    },
    initialize: function(options) {
      self = this;
      this.socket = options.socket;
      this.hostNickname = options.hostNickname;
      this.isHost = options.isHost;
      this.difficulty = 'Easy';
      if (options.isHost)
        this.socket.emit('createMultiplayer');
      else
        this.socket.emit('getPlayersInGameUpdate', this.hostNickname);

      this.socket.on('playersInGameUpdate', this.onPlayersInGameUpdate);
      this.socket.on('gameCancelled', this.onGameCancelled);
      this.socket.on('gameStarting', this.onGameStarting);
      this.render();
    },
    render: function() {
      this.$el.hide().html(_.template(template)({ isHost: this.isHost, difficulty: this.difficulty })).fadeIn(500);
    },
    changeDifficulty: function() {
      this.socket.emit('changeDifficulty', this.$('td#difficulty select').val());
    },
    showDifficultyModal: function() {
      // Don't create modal if it is already visible
      if (this.$('div.difficultyModal').length == 0) {
        this.$el.append('<div class="difficultyModal"></div>');
        this.$('div.difficultyModal').html(_.template(difficultyTmpl)());
        //var height = this.$('div.difficultyModal').height();
        //this.$('div.difficultyModal').css('margin-top', -height/2 - 90);
      }
    },
    closeDifficultyModal: function() {
      this.$('div.difficultyModal').remove();
    },
    clickColor: function(e) {
      // Taken from http://stackoverflow.com/questions/1740700/how-to-get-hex-color-value-rather-than-rgb-value
      var rgbToHex = function(rgb) {
        rgb = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        function hex(x) {
          return ('0' + parseInt(x).toString(16)).slice(-2);
        }
        return ('#' + hex(rgb[1]) + hex(rgb[2]) + hex(rgb[3])).toUpperCase();
      };
      var color = rgbToHex($(e.currentTarget).css('background-color'));
      this.socket.emit('changeColor', this.hostNickname, color);
    },
    clickStart: function() {
      this.socket.emit('startGame');
    },
    onPlayersInGameUpdate: function(players) {
      self.difficulty = players.difficulty;
      if (!self.isHost)
        self.$('td#difficulty span').text(self.difficulty);
      self.$('#numPlayersInGame').html((players.accepted.length+1) + '/16');
      
      // Create Player object of host
      players.host = Player.createNewFromObject(players.host);

      var host = $(_.template(playerTmpl)({ name: players.host.nickname,
                                            color: players.host.getColor() })).addClass('textGlow');
      self.$('#playersInGameList').html(host);
      for (var i in players.accepted) {
        // Create Player object of player
        players.accepted[i] = Player.createNewFromObject(players.accepted[i]);
        var player = $(_.template(playerTmpl)({ name: players.accepted[i].nickname,
                                                color: players.accepted[i].getColor() })).addClass('textGlowGreen');
        self.$('#playersInGameList').append(player);
      }
      for (var i in players.pending) {
        // We don't need to create a Player object of player here as we only do it accepted ones
        var player = $(_.template(playerTmpl)({ name: players.pending[i].nickname,
                                                color: '' })).addClass('textGlowOrange');
        self.$('#playersInGameList').append(player);
      }
      for (var i in players.declined) {
        // We don't need to create a Player object of player here as we only do it accepted ones
        var player = $(_.template(playerTmpl)({ name: players.declined[i].nickname,
                                                color: '' })).addClass('textGlowRed');
        self.$('#playersInGameList').append(player);
      }
    },
    onGameCancelled: function(hostNickname) {
      Backbone.history.navigate('/home', { replace: true });
      eventBus.trigger('showLobby');
    },
    onGameStarting: function() {
      Backbone.history.navigate('/home/play/multiplayer', { replace: true });
      eventBus.trigger('playMultiplayer', self.hostNickname);
    },
    teardown: function() {
      this.socket.removeListener('playersInGameUpdate', this.onPlayersInGameUpdate);
      this.socket.removeListener('gameCancelled', this.onGameCancelled);
      this.socket.removeListener('gameStarting', this.onGameStarting);
    }
  });

  return MultiplayerSetupView;
});