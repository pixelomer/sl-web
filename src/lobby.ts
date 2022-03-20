import { EventEmitter } from "stream";

const LOBBY_CHARS = "ABCDEFGHJKLMNPQRTUVWXY234689";

export class Lobby extends EventEmitter {
	private static allLobbies = new Map<string, Lobby>();
	private static lobbiesByIP = new Map<string, Lobby>();

	isLocked = false;

	code: string;
	clients = new Set<any>();
	lobbyHost: any = null;
	clientOrder: any[] = [];
	trains: number[] = [];

	constructor(IPAddress: string) {
		super();
		if (Lobby.allLobbies.size >= 1000) {
			throw new Error("Maximum lobby count reached.");
		}
		let code: string;
		do {
			code = "";
			for (let i=0; i<4; i++) {
				code += LOBBY_CHARS[Math.floor(Math.random() * LOBBY_CHARS.length)];
			}
		}
		while (Lobby.allLobbies.has(code));
		this.code = code;
		Lobby.allLobbies.set(code, this);
		if (IPAddress != null) {
			Lobby.lobbiesByIP.set(IPAddress, this);
		}
		this.once("close", () => {
			Lobby.allLobbies.delete(code);
			if (IPAddress != null) {
				if (Lobby.lobbiesByIP.get(IPAddress) === this) {
					Lobby.lobbiesByIP.delete(IPAddress);
				}
			}
		})
	}

	addClient(client) {
		if (this.isLocked) {
			throw new Error("Cannot add new clients to a locked lobby.");
		}
		if (this.clients.size === 0) {
			this.lobbyHost = client;
		}
		this.clients.add(client);
		this.emit("update");
	}

	removeClient(client) {
		if (client === this.lobbyHost) {
			this.isLocked = true;
			this.lobbyHost = null;
			this.clients.clear();
			this.clientOrder.splice(0, this.clientOrder.length);
			this.emit("close");
		}
		else {
			this.clients.delete(client);
			const index = this.clientOrder.indexOf(client);
			if (index !== -1) {
				this.clientOrder.splice(index, 1);
				const trainCount = this.trains[index];
				this.trains.splice(index, 1);
				this.emit("relocatedTrains", {
					target: this.clientOrder[index % this.clientOrder.length],
					count: trainCount
				});
			}
			this.emit("update");
		}
	}

	pickNext(client): number {
		if (!this.isLocked) {
			return null;
		}
		if (!this.clients.has(client)) {
			return null;
		}
		if (this.clientOrder.indexOf(client) !== -1) {
			return null;
		}
		this.clientOrder.push(client);
		this.trains.push(0);
		if (this.clientOrder.length === this.clients.size) {
			this.emit("start");
		}
		return this.clientOrder.length;
	}

	static withCode(code: string): Lobby {
		const lobby = Lobby.allLobbies.get(code);
		if ((lobby != null) && !lobby.isLocked) {
			return lobby;
		}
		return null;
	}

	static forIP(IPAddress: string): Lobby {
		if (IPAddress == null) {
			return null;
		}
		const lobby = Lobby.lobbiesByIP.get(IPAddress);
		if ((lobby != null) && !lobby.isLocked) {
			return lobby;
		}
		return null;
	}
}