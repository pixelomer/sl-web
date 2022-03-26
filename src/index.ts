import express from "express";
import http from "http";
import WebSocket from "ws";
import { Client } from "./client";
import { ls } from "./fake-ls";
import compression from "compression";

const FAKE_LS_HOST = process.env.FAKE_LS_HOST;

const expressApp = express();

expressApp.use(compression());

expressApp.use(async(request, response, next) => {
	if ((FAKE_LS_HOST != null) && (request.hostname === FAKE_LS_HOST)) {
		let output = await ls(request.path);
		output = output
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/\n/g, "<br>");
		response.send(
`<!DOCTYPE html>
<html>
<body>
  <pre>${output}</pre>
</body>
</html>`);
	}
	else {
		next();
	}
});

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