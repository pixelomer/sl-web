'use strict';

function ServerConnection() {
	if (!(this instanceof ServerConnection)) {
		return new ServerConnection();
	}

	const _this = this;

	/** @type {WebSocket} */
	_this._webSocket = null;
	/** @type { { isHost: boolean, code: string, clientCount: number } } */
	_this.currentLobby = null;
	/** @type {number} */
	_this.trainCount = null;
	_this._request = function(action, data) {
		_this._webSocket.send(JSON.stringify({ action, data }));
	};
	_this.requestJoin = function(code) {
		_this._request("join", { code });
	};
	_this.requestCreate = function() {
		_this._request("create");
	};
	_this.requestStartOrdering = function() {
		_this._request("start-ordering");
	}
	_this.trainLeaving = function() {
		_this._request("train-leaving");
	}
	_this.resetWebSocket = function(reason) {
		_this.currentLobby = null;
		_this.trainCount = null;
		const url = new URL(window.location);
		url.protocol = "ws";
		_this._webSocket = new WebSocket(url.toString());
		_this._webSocket.onmessage = function(event) {
			const message = JSON.parse(event.data);
			if (message.action === "new-train") {
				_this.onarrive();
			}
			else if (message.action === "nearby-lobby") {
				_this.onnearbylobby(message.data.code);
			}
			else if (message.action === "joined") {
				_this.currentLobby = message.data;
				_this.onjoin(_this.currentLobby);
				_this.onupdate(_this.currentLobby);
			}
			else if (message.action === "update") {
				Object.assign(_this.currentLobby, message.data);
				_this.onupdate(_this.currentLobby);
			}
			else if (message.action === "error") {
				_this.onerror(message.data.message);
				_this.currentLobby = null;
				_this.trainCount = null;
			}
			else if (message.action === "picked") {
				_this.onpicked(message.data.number);
			}
			else if (message.action === "start-ordering") {
				_this.onstartordering();
			}
			else if (message.action === "start") {
				_this.trainCount = 0;
				_this.onstart();
			}
			else if (message.action === "train-arriving") {
				_this.trainCount++;
			}
		}
		_this._webSocket.onclose = function(event) {
			setTimeout(function() {
				_this.resetWebSocket(event.reason);
			}, 1000);
		}
		_this.onreset(reason);
	};
	_this.pickMe = function() {
		_this._request("pick-me");
	}
	_this.onpicked = function(order) {}
	_this.onarrive = function() {};
	_this.onreset = function(reason) {};
	_this.onjoin = function(lobby) {};
	_this.onupdate = function(updatedLobby) {};
	_this.onerror = function(error) {};
	_this.onstart = function() {};
	_this.onstartordering = function() {};
	_this.onnearbylobby = function(code) {};

	setInterval(function() {
		_this._request("ping");
	}, 20000);

	_this.resetWebSocket();

	return this;
}