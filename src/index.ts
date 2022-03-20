import express from "express";
import http from "http";
import WebSocket from "ws";
import { Client } from "./client";

const expressApp = express();
expressApp.get("*", express.static("static"));

const server = http.createServer(expressApp);

const webSocket = new WebSocket.Server({ server });
const connections = new Set<Client>();
webSocket.on("connection", (socket, request) => {
	const client = new Client(socket, request.socket.remoteAddress);
	connections.add(client);
	socket.on("close", () => {
		connections.delete(client);
	});
});

server.listen(8080);