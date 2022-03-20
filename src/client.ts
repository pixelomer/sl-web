import WebSocket from "ws";
import { Lobby } from "./lobby";

interface Message {
	action: string,
	data: any
}

export class Client {
	lobby: Lobby;
	socket: WebSocket;
	IPAddress: string;

	constructor(socket: WebSocket, IPAddress: string) {
		this.IPAddress = IPAddress;
		this.socket = socket;
		const nearbyLobby = Lobby.forIP(IPAddress);
		if (nearbyLobby != null) {
			this.sendMessage("nearby-lobby", { code: nearbyLobby.code });
		}
		socket.on("message", (data) => {
			let message: Message;
			try {
				message = JSON.parse(data.toString('ascii'));
			}
			catch {
				socket.close();
				return;
			}
			switch (message?.action) {
				case "create":
					if (this.lobby != null) {
						socket.close();
						return;
					}
					this.onCreateRequest();
					break;
				case "join":
					const code = message.data?.code;
					if (typeof code !== 'string') {
						socket.close();
						return;
					}
					this.onJoinRequest(code);
					break;
				case "pick-me":
					this.onPickMeRequest();
					break;
				case "start-ordering":
					this.onStartOrderingRequest();
					break;
				case "train-leaving":
					this.onTrainLeavingRequest();
					break;
			}
		});

		socket.on("close", () => {
			this.onDisconnect();
		})
	}

	onTrainLeavingRequest() {
		if (this.lobby == null) {
			return;
		}
		const currentIndex = this.lobby.clientOrder.indexOf(this);
		if (currentIndex === -1) {
			// ???
			return;
		}
		this.lobby.trains[currentIndex]--;
		const nextIndex = (currentIndex + 1) % this.lobby.clientOrder.length;
		this.lobby.trains[nextIndex]++;
		const nextClient: Client = this.lobby.clientOrder[nextIndex];
		nextClient.sendMessage("train-arriving");
	}

	sendMessage(action: string, data?: any) {
		this.socket.send(JSON.stringify({ action, data }));
	}

	getLobbyDescription() {
		return {
			isHost: (this.lobby.lobbyHost === this),
			code: this.lobby.code,
			clientCount: this.lobby.clients.size
		};
	}

	sendError(message: string) {
		if (this.lobby != null) {
			const lobby = this.lobby;
			this.lobby = null;
			lobby.removeClient(this);
		}
		this.sendMessage("error", { message });
	}

	onPickMeRequest() {
		if (this.lobby != null) {
			const number = this.lobby.pickNext(this);
			if (number != null) {
				this.sendMessage("picked", { number });
			}
		}
	}

	onStartOrderingRequest() {
		if (this.lobby != null) {
			if (this.lobby.lobbyHost !== this) {
				return;
			}
			this.lobby.isLocked = true;
			const clients: Set<Client> = this.lobby.clients;
			for (const client of clients) {
				client.sendMessage("start-ordering");
			}
		}
	}

	joinLobby(lobby: Lobby) {
		lobby.addClient(this);
		this.lobby = lobby;
		lobby.on("update", () => {
			if (lobby !== this.lobby) return;
			this.sendMessage("update", this.getLobbyDescription());
		});
		lobby.on("relocatedTrains", (data) => {
			if (lobby !== this.lobby) return;
			const target: Client = data.target;
			if (target !== this) {
				return;
			}
			const trainCount: number = data.count;
			for (let i=0; i<trainCount; i++) {
				this.sendMessage("train-arriving");
			}
		});
		lobby.once("close", () => {
			if (lobby !== this.lobby) return;
			this.sendError("This lobby was closed.");
			this.lobby = null;
		});
		lobby.once("start", () => {
			if (lobby !== this.lobby) return;
			this.sendMessage("start");
			if (this.lobby.clientOrder[0] === this) {
				this.sendMessage("train-arriving");
			}
		});
		this.sendMessage("joined", this.getLobbyDescription());
	}

	onCreateRequest() {
		let lobby: Lobby;
		try {
			lobby = new Lobby(this.IPAddress);
		}
		catch {
			this.sendError("Could not create a new lobby.");
			return;
		}
		this.joinLobby(lobby);
	}

	onJoinRequest(code: string) {
		code = code.toUpperCase();
		const lobby = Lobby.withCode(code);
		if (lobby == null) {
			this.sendError("Failed to join this lobby.");
			return;
		}
		this.joinLobby(lobby);
	}
	
	onDisconnect() {
		if (this.lobby != null) {
			this.lobby.removeClient(this);
		}
	}
}