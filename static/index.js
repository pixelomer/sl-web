'use strict';

/** @type {string[][]} */
const trainFrames = window.trainFrames;

/** @type {string[][]} */
const smokeFrames = window.smokeFrames;

/** @type {number} */
const trainHeight = window.trainHeight;

/** @type {number} */
const trainWidth = window.trainWidth;

const codeBlock = document.getElementById("sl");
const canvas = document.getElementById("canvas");
const configScreen = document.getElementById("configuration-screen");

var trainPosition = { x:0, y:0 };
var trainFrameIndex = 0;

var smokePosition = { x:0, y:0 };
var smokeFrameIndex = 0;

var frameCounter = 0;

var serverConnection = new ServerConnection();

var metrics = {
	characterSize: { width: 0, height: 0 },
	width: 0,
	height: 0,
	lineCount: 0,
	columnCount: 0
}

function clearCanvas() {
	codeBlock.innerText = "".padEnd(metrics.lineCount, "\n");
}

var lastResizeDraw = new Date(0);

function resetMetrics() {
	const computedBody = window.getComputedStyle(document.body, null);
	const width = parseFloat(computedBody.width);
	const height = parseFloat(computedBody.height);

	const computedCodeBlock = window.getComputedStyle(codeBlock, null);
	const context = canvas.getContext("2d");
	context.font = computedCodeBlock.font;

	const measurement = context.measureText("A");
	const charHeight = measurement.actualBoundingBoxAscent -
		measurement.actualBoundingBoxDescent + 4;
	const charWidth = measurement.width;

	metrics = {
		characterSize: {
			width: charWidth,
			height: charHeight
		},
		width: width + charWidth,
		height: height,
		lineCount: Math.floor(height / charHeight) + 1,
		columnCount: Math.floor(width / charWidth) + 1
	};
	codeBlock.style.lineHeight = charHeight + "px";
	
	if ((new Date() - lastResizeDraw) >= 100) {
		draw();
		lastResizeDraw = new Date();
	}
}

window.onresize = function() {
	resetMetrics();
	smokePosition.y = Math.floor((metrics.lineCount / 2) -
		((trainFrames[0].length + smokeFrames[0].length) / 2)) - 3;
	trainPosition.y = smokePosition.y + smokeFrames[0].length;
}

function writeLine(x, y, lines) {
	if (typeof lines === 'string') {
		lines = [ lines ];
	}
	if (y < 0) {
		return;
	}
	if (x < 0) {
		lines = lines.map(function(text) {
			return text.slice(-x)
		});
		x = 0;
	}
	const data = codeBlock.innerText.split("\n");
	if (y >= data.length) {
		return;
	}
	for (let i=0; i<lines.length; i++) {
		if (data[y+i] == null) break;
		data[y+i] = "".padEnd(x, " ") + lines[i].slice(0, metrics.columnCount - x);
	}
	codeBlock.innerText = data.join("\n");
}

var lastAlert = new Date(0);

function update() {
	if (metrics.columnCount < 20) {
		if ((new Date() - lastAlert) >= 2000) {
			alert("Window too small!");
			lastAlert = new Date();
		}
		return;
	}
	if ((trainPosition.x === -6) && (serverConnection.trainCount != null)) {
		serverConnection.trainLeaving();
	}
	if ((trainPosition.x + trainWidth) < -5) {
		if (serverConnection.trainCount != null) {
			serverConnection.trainCount--;
		}
		resetTrain();
	}
	trainPosition.x -= 1;
	frameCounter = (frameCounter + 1) % 12;
	trainFrameIndex = (trainFrameIndex + 1) % trainFrames.length;
	if (frameCounter % 4 === 0) {
		smokePosition.x = trainPosition.x + 2;
		smokeFrameIndex = (smokeFrameIndex + 1) % smokeFrames.length;
	}
}

function draw() {
	clearCanvas();
	writeLine(smokePosition.x, smokePosition.y, smokeFrames[smokeFrameIndex]);
	writeLine(trainPosition.x, trainPosition.y, trainFrames[trainFrameIndex]);	
}

function resetTrain() {
	trainPosition.x = metrics.columnCount;
	smokePosition.x = trainPosition.x + 2;
}

function initialize() {
	window.onresize();
	resetTrain();
	setInterval(() => {
		if (serverConnection.trainCount === 0) {
			resetTrain();
		}
		update();
		draw();
	}, 50);
}

function hideElementWithId(id) {
	document.getElementById(id).classList.add("hidden");
}

function showElementWithId(id) {
	document.getElementById(id).classList.remove("hidden");
}

function activateMenu(menuName) {
	for (const child of configScreen.children) {
		if (child.tagName === "DIV") {
			child.classList.add("hidden");
		}
	}
	showElementWithId(menuName);
}

function isMenuActive(menuName) {
	return !document.getElementById(menuName).classList.contains("hidden");
}

function showProgressMenu(message) {
	document.getElementById("progress-message").innerText = message;
	activateMenu("progress-menu");
}

function showOrderingMenu() {
	showElementWithId("ordering-description")
	hideElementWithId("order-number");
	activateMenu("ordering-menu");
}

function showError(message) {
	showElementWithId("configuration-overlay")
	document.getElementById("error-message").innerText = message;
	activateMenu("error-menu");
}

function showHomeMenu() {
	activateMenu("home-menu");
}

function createLobby() {
	showProgressMenu("Creating a new lobby...");
	serverConnection.requestCreate();
}

function joinLobby() {
	const lobbyCode = document.getElementById("join-code").value;
	showProgressMenu("Joining lobby...");
	serverConnection.requestJoin(lobbyCode);
}

function startOrdering() {
	showProgressMenu("Starting...");
	serverConnection.requestStartOrdering();
}

document.onkeydown = function(event) {
	if ((event.code === "Enter") && isMenuActive("join-menu")) {
		joinLobby();
	}
	else if ((event.code === "Space") && isMenuActive("ordering-menu")) {
		serverConnection.pickMe();
	}
}

serverConnection.onjoin = function() {
	if (this.currentLobby.isHost) {
		activateMenu("host-menu");
	}
	else {
		showProgressMenu("Waiting for host...");
	}
}

serverConnection.onupdate = function() {
	document.getElementById("lobby-code").innerText = this.currentLobby.code;
	document.getElementById("joined-count").innerText = this.currentLobby.clientCount;
	document.getElementById("joined-plural").innerText = (this.currentLobby.clientCount === 1) ? "" : "s";
}

serverConnection.onerror = function(error) {
	showError(error);
}

serverConnection.onreset = function(reason) {
	showError("Connection to the server was lost.");
}

serverConnection.onpicked = function(number) {
	hideElementWithId("ordering-description");
	document.getElementById("order-number").innerText = number.toString();
	showElementWithId("order-number");
}

serverConnection.onstartordering = function() {
	showOrderingMenu();
}

serverConnection.onstart = function() {
	resetTrain();
	hideElementWithId("configuration-overlay");
}

serverConnection.onnearbylobby = function(code) {
	document.getElementById("join-code").value = code;
}

window.onload = function() {
	initialize();
}