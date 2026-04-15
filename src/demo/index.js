"use strict";

import {
	IntegerHandler,
	Seamstress
} from "../seamstress/index.mjs";
import {
	StreamQueue
} from "../../libs/rochelle@ltgcgo/splicer.mjs";
import {
	$e, $a
} from "../../libs/lightfelt@ltgcgo/main/quickPath";
import {fileOpen} from "../../libs/browser-fs-access@GoogleChromeLabs/browser_fs_access.min.js";

const fileProps = JSON.parse('{"extensions":[],"startIn":"pictures","id":"binOpener","description":"Open a file in a tag-length-value structure."}');
const fileTypes = {
	"mid": "smf",
	"kar": "smf",
	"aif": "iff",
	"aiff": "iff",
	"dls": "riff",
	"rmi": "riff",
	"sf2": "riff",
	"wav": "riff",
	"webp": "riff",
	"rseam": "rseam",
	"vseam": "vseam"
};
for (let extension in fileTypes) {
	fileProps.extensions.push(`.${extension.toLowerCase()}`);
	fileProps.extensions.push(`.${extension.toUpperCase()}`);
};
const mimeTypes = {
	"audio/midi": "smf",
	"audio/aiff": "iff",
	"audio/wav": "riff",
	"audio/wave": "riff",
	"image/webp": "riff"
};

const textLevels = "clear,danger,warning,success,info,none".split(",");
const createLine = function (level = 5, text) {
	if (!(level > 0)) {
		return;
	};
	let element = document.createElement("div");
	if (text?.length >= 0) {
		element.classList.add("verbose-text");
		let selectedLevel = textLevels[level] ?? "none";
		if (selectedLevel && selectedLevel !== "none") {
			element.classList.add(`has-text-${selectedLevel}`);
		};
		/*if (element.childNodes.length > 0) {
			element.childNodes[0].remove();
		};*/
		element.append(text);
	};
	return element;
};

const textStreamQueue = new StreamQueue();
const textConsoleHost = $e("#textRenderer");
(async () => {
	for await (let lineInfo of textStreamQueue.readable) {
		let createdElement = createLine(...lineInfo);
		if (createdElement) {
			textConsoleHost.append(createdElement);
		} else {
			while (textConsoleHost.childNodes.length > 0) {
				textConsoleHost.childNodes[0].remove();
			};
		};
	};
}) ();
/*(async () => {
	await textStreamQueue.enqueue([4, "Kristal has entered the throne room."]);
	await textStreamQueue.enqueue([2, "Kristal has successfully gained the horni throne."]);
	await textStreamQueue.enqueue([1, "Kristal has declared rulership in the Horni Empire."]);
})();*/

let isDemoActive = false;
const typeSelector = $e("select#loaderType");
const summarizeSeamstressChunk = (sChunk) => {
	return `#${sChunk.id} (${sChunk.type}, #${sChunk.chunkId}): ${sChunk.offset}/${sChunk.size}, ${sChunk.data.length} B.`;
};
const handleBinaryStream = async function (selectedFile) {
	let intendedMode = typeSelector.value;
	if (intendedMode === "auto") {
		let extensionIdx = selectedFile.name?.lastIndexOf(".");
		if (extensionIdx > 0) {
			let extensionName = selectedFile.name.substring(extensionIdx + 1).toLowerCase();
			intendedMode = fileTypes[extensionName];
			if (!intendedMode) {
				await textStreamQueue.enqueue([1, `Association for extension "${extensionName}" is not found for: ${selectedFile.name}.`]);
				return;
			};
		} else if (!selectedFile.mode) {
			await textStreamQueue.enqueue([1, `Invalid extension for name: ${selectedFile.name}.`]);
			return;
		};
	};
	if (intendedMode !== "auto") {
		selectedFile.mode = intendedMode;
	};
	if (!selectedFile.name) {
		selectedFile.name = "<internal>";
	};
	if (!selectedFile.size) {
		selectedFile.size = -1;
	};
	await textStreamQueue.enqueue([0]);
	await textStreamQueue.enqueue([4, `Showing the structure of binary stream "${selectedFile.name}" (${selectedFile.size >= 0 ? selectedFile.size : "N/A"} B).\nMode: ${selectedFile.mode}`]);
	try {
		let map;
		switch (selectedFile.mode) {
			case "smf": {
				let rawParser = new Seamstress();
				rawParser.headerSize = 0;
				rawParser.type = Seamstress.TYPE_4CC | Seamstress.ENDIAN_B | Seamstress.LENGTH_U32;
				rawParser.debugMode = true;
				let splitStream = selectedFile.stream.tee();
				(async () => {
					for await (let chunk of rawParser.readChunks(splitStream[1])) {
						console.debug(summarizeSeamstressChunk(chunk));
					};
					console.info("Finished chunk skimming.");
				})();
				map = await rawParser.getMapFromStream(splitStream[0]);
				break;
			};
			case "iff": {
				let rawParser = new Seamstress();
				rawParser.headerSize = 12;
				rawParser.type = rawParser.TYPE_4CC | rawParser.ENDIAN_B | rawParser.LENGTH_U32 | rawParser.MASK_PADDED;
				rawParser.debugMode = true;
				map = await rawParser.getMapFromStream(selectedFile.stream);
				break;
			};
			case "riff": {
				let rawParser = new Seamstress();
				rawParser.headerSize = 12;
				rawParser.type = rawParser.TYPE_4CC | rawParser.ENDIAN_L | rawParser.LENGTH_U32 | rawParser.MASK_PADDED;
				rawParser.debugMode = true;
				let splitStream = selectedFile.stream.tee();
				(async () => {
					for await (let chunk of rawParser.readChunks(splitStream[1])) {
						console.debug(summarizeSeamstressChunk(chunk));
					};
					console.info("Finished chunk skimming.");
				})();
				map = await rawParser.getMapFromStream(splitStream[0]);
				break;
			};
			default: {
				await textStreamQueue.enqueue([1, `Stream type "${selectedFile.mode}" is not yet supported.`]);
				return;
			};
		};
		await textStreamQueue.enqueue([127, `\nType          No.     Offset      Size`]);
		for (let [key, value] of map.entries()) {
			let showKey = key;
			if (typeof key === "number") {
				showKey = `0x${key.toString(16)}`;
			};
			showKey = showKey.padEnd(10, " ");
			let count = 1;
			for (let [offset, size] of value) {
				if (count === 1) {
					await textStreamQueue.enqueue([127, `${showKey}  - #${`${count}`.padStart(4, "0")}   0x${offset.toString(16).padStart(8, "0")}  ${size} B`]);
				} else {
					await textStreamQueue.enqueue([127, `            - #${`${count}`.padStart(4, "0")}   0x${offset.toString(16).padStart(8, "0")}  ${size} B`]);
				};
				count ++;
			};
		};
		isDemoActive = true;
	} catch (err) {
		await textStreamQueue.enqueue([1, `Uncaught ${err.name}: ${err.message ?? "No error message was provided."}\n${err.stack}`]);
		console.error(err);
	};
};
const fetchAction = async function () {
	const fetchUrl = $e("input#fetchUrl").value;
	await textStreamQueue.enqueue([0]);
	await textStreamQueue.enqueue([4, `Waiting for the response from URL: ${fetchUrl}`])
	let resp = await fetch(fetchUrl);
	let passedObject = {
		size: -1,
		stream: resp.body
	};
	if (resp.headers.has("Content-Length")) {
		passedObject.size = parseInt(resp.headers.get("Content-Length"));
	};
	if (resp.headers.has("Content-Type")) {
		passedObject.mode = mimeTypes[resp.headers.get("Content-Type")] ?? "unknown";
	};
	try {
		await handleBinaryStream(passedObject);
	} catch (err) {
		await textStreamQueue.enqueue([1, `Uncaught ${err.name}: ${err.message ?? "No error message was provided."}\n${err.stack}`]);
	};
};
$e("button#doFetch").addEventListener("mouseup", fetchAction);
$e("button#doOpen").addEventListener("mouseup", async function () {
	let selectedFile = await fileOpen(fileProps);
	if (selectedFile) {
		try {
			await handleBinaryStream({
				name: selectedFile.name,
				size: selectedFile.size,
				stream: await selectedFile.stream()
			});
		} catch (err) {
			await textStreamQueue.enqueue([1, `Uncaught ${err.name}: ${err.message ?? "No error message was provided."}\n${err.stack}`]);
		};
	};
});

setTimeout(fetchAction, 5000);
