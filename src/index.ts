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
	// Trust proxies
	//@ts-ignore
	const forwardedFor: string = request?.headers["x-forwarded-for"];
	const IP = (forwardedFor?.split(", ")?.[0] ?? request.socket.remoteAddress);
	const client = new Client(socket, IP);
	connections.add(client);
	socket.on("close", () => {
		connections.delete(client);
	});
});

server.listen(process.env.PORT ?? 8080);