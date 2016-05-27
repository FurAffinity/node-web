"use strict";

def("editor", [], function () {
	var prosemirror = require("prosemirror");
	var model = require("prosemirror/dist/model");
	var format = require("prosemirror/dist/format");

	var hasStorage = (function () {
		try {
			localStorage.setItem("_test", "1");
			localStorage.removeItem("_test");
			return true;
		} catch (e) {
			return false;
		}
	})();

	function const_(value) {
		return function () {
			return value;
		};
	}

	function forEach(list, callback) {
		for (var i = 0, l = list.length; i < l; i++) {
			callback(list[i]);
		}
	}

	function findClosestByName(element, nodeName, container) {
		while (element !== container) {
			if (element.nodeName === nodeName) {
				return element;
			}

			element = element.parentNode;
		}

		return null;
	}

	function isNormalClick(e) {
		return !(
			e.button ||
			e.ctrlKey ||
			e.shiftKey ||
			e.altKey ||
			e.metaKey
		);
	}

	function animateSlide(canvas) {
		var canvasWidth = canvas.width;
		var canvasHeight = canvas.height;
		var g = canvas.getContext("2d");

		var circleParticles = [];
		var circleOnlyParticles = [];
		var lineParticles = [];
		var endParticles = [];
		var openAngle = 0.5;
		var radius = 11;
		var h = radius * Math.sin(openAngle);
		var w = 208;
		var angle;
		var x;

		for (angle = 0; angle < Math.PI * 2; angle += Math.random() * 0.3) {
			var p = {
				x: radius * (1 + Math.cos(angle)),
				y: radius * (1 + Math.sin(angle)),
				opacity: 0.3 + 0.7 * Math.random(),
				d: Math.random() < 0.5 ? -1 : 1,
			};

			if (angle > openAngle && angle < Math.PI * 2 - openAngle) {
				circleParticles.push(p);
			} else {
				circleOnlyParticles.push(p);
			}
		}

		for (x = 0; x < w; x += Math.random() * 7) {
			lineParticles.push({
				x: 2 * radius + x,
				y: radius * (1 + Math.sin(openAngle)),
				opacity: 0.3 + 0.7 * Math.random(),
				d: Math.random() < 0.5 ? -1 : 1,
			});
		}

		for (x = 0; x < w; x += Math.random() * 7) {
			lineParticles.push({
				x: 2 * radius + x,
				y: radius * (1 - Math.sin(openAngle)),
				opacity: 0.3 + 0.7 * Math.random(),
				d: Math.random() < 0.5 ? -1 : 1,
			});
		}

		lineParticles.sort(function (a, b) {
			return a.x - b.x;
		});

		for (angle = -Math.PI / 2; angle < Math.PI / 2; angle += Math.random() * 0.3 * radius / h) {
			endParticles.push({
				x: radius + h * Math.cos(angle),
				y: radius + h * Math.sin(angle),
				opacity: 0.3 + 0.7 * Math.random(),
				d: Math.random() < 0.5 ? -1 : 1,
			});
		}

		var dx = 0;

		function animateAndDraw(particle, offset, brightness) {
			var opacity = particle.opacity;

			opacity += 0.03 * particle.d * Math.random();

			if (opacity < 0.3) {
				opacity = 0.3;
				particle.d = 1;
			} else if (opacity > 1) {
				opacity = 1;
				particle.d = -1;
			}

			particle.opacity = opacity;

			var green = 200 + 55 * brightness | 0;
			var blue = 255 * brightness | 0;

			g.fillStyle = "rgba(255, " + green + ", " + blue + ", " + opacity + ")";
			g.fillRect(particle.x + offset, particle.y, 1, 1);
		}

		var brightness = 0;
		var brightnessDirection = 1;
		var drawRequest;

		function drawAndAnimate() {
			g.clearRect(0, 0, canvasWidth, canvasHeight);

			if (dx === w) {
				brightness += 0.03 * brightnessDirection;

				if (brightness < 0) {
					brightness = 0;
					brightnessDirection = 1;
				} else if (brightness > 1) {
					brightness = 1;
					brightnessDirection = -1;
				}
			} else if (brightness > 0) {
				brightness -= 0.03;
			}

			var i;
			var l;

			for (i = 0, l = circleParticles.length; i < l; i++) {
				animateAndDraw(circleParticles[i], 0, brightness);
			}

			if (dx < radius) {
				for (i = 0, l = circleOnlyParticles.length; i < l; i++) {
					animateAndDraw(circleOnlyParticles[i], 0, brightness);
				}
			} else {
				for (i = 0, l = lineParticles.length; i < l; i++) {
					if (lineParticles[i].x > radius + dx) {
						break;
					}

					animateAndDraw(lineParticles[i], 0, brightness);
				}

				for (i = 0, l = endParticles.length; i < l; i++) {
					animateAndDraw(endParticles[i], dx, brightness);
				}
			}

			drawRequest = requestAnimationFrame(drawAndAnimate);
		}

		drawAndAnimate();

		return {
			stop: function () {
				cancelAnimationFrame(drawRequest);
			},
			slide: function (cursorLeft) {
				dx = Math.min(w, cursorLeft - radius);
			},
			isComplete: function (cursorLeft) {
				return cursorLeft - radius >= w;
			},
		};
	}

	function ColorMark() {
		model.MarkType.call(this);
	}

	Object.setPrototypeOf(ColorMark, model.MarkType);

	ColorMark.prototype = Object.create(model.MarkType.prototype, {
		constructor: {
			configurable: true,
			writable: true,
			value: ColorMark,
		},
		attrs: {
			configurable: true,
			writable: true,
			value: {
				color: new model.Attribute(),
			},
		},
		serializeDOM: {
			configurable: true,
			writable: true,
			value: function (mark, s) {
				return s.elt("span", {
					"data-color": mark.attrs.color,
				});
			},
		},
	});

	ColorMark.register("command", "set", {
		derive: {
			params: [
				{ label: "Color", attr: "color" },
			],
		},
		label: "Set color",
	});

	ColorMark.register("command", "unset", {
		derive: true,
		label: "Remove color",
	});

	ColorMark.register("parseDOM", "span", {
		parse: function (dom, state) {
			state.wrapMark(
				dom,
				this.create({ color: dom.getAttribute("data-color") })
			);
		},
		selector: "[data-color]",
	});

	function UnderlineMark() {
		model.MarkType.call(this);
	}

	Object.setPrototypeOf(UnderlineMark, model.MarkType);

	UnderlineMark.prototype = Object.create(model.MarkType.prototype, {
		constructor: {
			configurable: true,
			writable: true,
			value: UnderlineMark,
		},
		serializeDOM: {
			configurable: true,
			writable: true,
			value: function (mark, s) {
				return s.elt("u");
			},
		},
	});

	UnderlineMark.register("command", "set", {
		derive: true,
		label: "Set underline",
	});

	UnderlineMark.register("command", "unset", {
		derive: true,
		label: "Unset underline",
	});

	UnderlineMark.register("command", "toggle", {
		derive: true,
		label: "Toggle underline",
		keys: ["Mod-U"],
	});

	UnderlineMark.register("parseDOM", "u", { parse: "mark" });
	UnderlineMark.register("parseDOM", "ins", { parse: "mark" });
	UnderlineMark.register("parseDOMStyle", "text-decoration", {
		parse: function (value, state, inner) {
			if (value === "underline") {
				state.wrapMark(inner, this);
			} else {
				inner();
			}
		},
	});

	function DeleteMark() {
		model.MarkType.call(this);
	}

	Object.setPrototypeOf(DeleteMark, model.MarkType);

	DeleteMark.prototype = Object.create(model.MarkType.prototype, {
		constructor: {
			configurable: true,
			writable: true,
			value: DeleteMark,
		},
		serializeDOM: {
			configurable: true,
			writable: true,
			value: function (mark, s) {
				return s.elt("del");
			},
		},
	});

	DeleteMark.register("command", "set", {
		derive: true,
		label: "Set deletion",
	});

	DeleteMark.register("command", "unset", {
		derive: true,
		label: "Unset deletion",
	});

	DeleteMark.register("command", "toggle", {
		derive: true,
		label: "Toggle deletion",
		keys: ["Mod-S"],
	});

	DeleteMark.register("parseDOM", "s", { parse: "mark" });
	DeleteMark.register("parseDOM", "del", { parse: "mark" });
	DeleteMark.register("parseDOMStyle", "text-decoration", {
		parse: function (value, state, inner) {
			if (value === "line-through") {
				state.wrapMark(inner, this);
			} else {
				inner();
			}
		},
	});

	function contentToBBCode(node) {
		var result = "";

		node.forEach(function (child) {
			result += child.type.serializeBBCode(child);
		});

		return result;
	}

	function toBBCode(doc) {
		return contentToBBCode(doc).trim();
	}

	format.defineTarget("bbcode", toBBCode);

	model.BlockQuote.prototype.serializeBBCode = function (node) {
		return "[QUOTE]" + contentToBBCode(node) + "[/QUOTE]";
	};

	model.HorizontalRule.prototype.serializeBBCode = const_("\n-----\n");

	model.Paragraph.prototype.serializeBBCode = function (node) {
		return "\n" + contentToBBCode(node) + "\n";
	};

	model.HardBreak.prototype.serializeBBCode = const_("\n");

	model.Text.prototype.serializeBBCode = function (node) {
		var open =
			node.marks
				.map(function (mark) {
					return mark.type.openBBCode(mark);
				})
				.join("");

		var close =
			node.marks
				.map(function (mark) {
					return mark.type.closeBBCode(mark);
				})
				.reverse()
				.join("");

		return open + node.text + close;
	};

	model.StrongMark.prototype.openBBCode = const_("[B]");
	model.StrongMark.prototype.closeBBCode = const_("[/B]");

	model.EmMark.prototype.openBBCode = const_("[I]");
	model.EmMark.prototype.closeBBCode = const_("[/I]");

	model.LinkMark.prototype.openBBCode = function (mark) {
		var encodedHref = mark.attrs.href.replace(/"/g, "%22");

		return '[URL="' + encodedHref + '"]';
	};
	model.LinkMark.prototype.closeBBCode = const_("[/URL]");

	UnderlineMark.prototype.openBBCode = const_("[U]");
	UnderlineMark.prototype.closeBBCode = const_("[/U]");

	DeleteMark.prototype.openBBCode = const_("[S]");
	DeleteMark.prototype.closeBBCode = const_("[/S]");

	ColorMark.prototype.openBBCode = function (mark) {
		return "[COLOR=" + mark.attrs.color + "]";
	};
	ColorMark.prototype.closeBBCode = const_("[/COLOR]");

	var editorContainerTemplate = (function () {
		var editor = document.createElement("div");
		editor.className = "editor";

		var editorToolbar = document.createElement("div");
		editorToolbar.className = "editor-toolbar";

		editorToolbar.innerHTML =
			'<button type="button" data-command="strong:toggle" class="editor-bold" title="Bold" tabindex="-1">B</button>' +
			'<button type="button" data-command="em:toggle" class="editor-italic" title="Italicize" tabindex="-1">I</button>' +
			'<button type="button" data-command="underline:toggle" class="editor-underline" title="Underline" tabindex="-1">U</button>' +
			'<button type="button" data-command="del:toggle" class="editor-strike" title="Strikethrough" tabindex="-1">S</button>' +
			'<button type="button" class="editor-link" title="Link" tabindex="-1">🔗</button>' +
			'<button type="button" class="editor-color" title="Text color" tabindex="-1">A<span class="editor-color-preview"></span></button>' +
			'<span class="editor-palette editor-palette-colors" hidden>' +
				'<button type="button" data-command="color:unset" class="editor-color-option" title="Default" tabindex="-1"><span style="background-color: black; color: black;"></span></button>' +
				'<button type="button" class="editor-color-option" title="Red" tabindex="-1"><span style="background-color: red; color: black;"></span></button>' +
				'<button type="button" class="editor-color-option" title="Orange" tabindex="-1"><span style="background-color: orange; color: red;"></span></button>' +
				'<button type="button" class="editor-color-option" title="Yellow" tabindex="-1"><span style="background-color: yellow; color: orange;"></span></button>' +
				'<button type="button" class="editor-color-option" title="Green" tabindex="-1"><span style="background-color: green; color: yellow;"></span></button>' +
				'<button type="button" class="editor-color-option" title="Blue" tabindex="-1"><span style="background-color: blue; color: green;"></span></button>' +
				'<button type="button" class="editor-color-option" title="Indigo" tabindex="-1"><span style="background-color: indigo; color: blue;"></span></button>' +
				'<button type="button" class="editor-color-option" title="Violet" tabindex="-1"><span style="background-color: violet; color: indigo;"></span></button>' +
			"</span>";

		editor.appendChild(editorToolbar);

		return editor;
	})();

	function createEditorContainer() {
		return editorContainerTemplate.cloneNode(true);
	}

	function createEditor(textarea) {
		var editorContainer = createEditorContainer();
		var editorToolbar = editorContainer.getElementsByClassName("editor-toolbar")[0];
		var colorPalette = editorToolbar.getElementsByClassName("editor-palette-colors")[0];

		var editor = new prosemirror.ProseMirror({
			place: editorContainer,
			schema: new model.Schema({
				nodes: {
					doc: { type: model.Doc, content: "block+" },

					paragraph: { type: model.Paragraph, content: "inline<_>*", group: "block" },
					blockquote: { type: model.BlockQuote, content: "block+", group: "block" },
					horizontal_rule: { type: model.HorizontalRule, group: "block" },

					text: { type: model.Text, group: "inline" },
					hard_break: { type: model.HardBreak, group: "inline" },
				},
				marks: {
					em: model.EmMark,
					strong: model.StrongMark,
					link: model.LinkMark,
					color: ColorMark,
					del: DeleteMark,
					underline: UnderlineMark,
				},
			}),
		});

		if (textarea.value.substring(0, 8) === "[[html]]") {
			editor.setContent(textarea.value.substring(8), "html");
		} else {
			editor.setContent(textarea.value, "text");
		}

		var serializeTimer = null;

		function serializeContent() {
			textarea.value = "[[html]]" + editor.getContent("html");
			serializeTimer = null;
		}

		editor.on("change", function () {
			if (serializeTimer === null) {
				serializeTimer = setTimeout(serializeContent, 1000);
			}
		});

		function updateActiveMarks() {
			var activeMarks = {
				strong: editor.commands["strong:toggle"].active(editor),
				em: editor.commands["em:toggle"].active(editor),
				underline: editor.commands["underline:toggle"].active(editor),
				del: editor.commands["del:toggle"].active(editor),
			};

			forEach(editor.activeMarks(), function (activeMark) {
				var name = activeMark.type.name;

				if (name in activeMarks && activeMarks[name] === undefined) {
					activeMarks[name] = true;
				}
			});

			var boldToggle = editorToolbar.children[0];
			var italicsToggle = editorToolbar.children[1];
			var underlineToggle = editorToolbar.children[2];
			var strikeToggle = editorToolbar.children[3];
			var linkToggle = editorToolbar.children[4];

			boldToggle.classList.toggle("selected", !!activeMarks.strong);
			italicsToggle.classList.toggle("selected", !!activeMarks.em);
			underlineToggle.classList.toggle("selected", !!activeMarks.underline);
			strikeToggle.classList.toggle("selected", !!activeMarks.del);
			linkToggle.classList.toggle("selected", !editor.commands["link:set"].select(editor));
		}

		editor.on("selectionChange", updateActiveMarks);
		editor.on("activeMarkChange", updateActiveMarks);

		editorToolbar.addEventListener("mousedown", function (e) {
			e.preventDefault();
		});

		editorToolbar.addEventListener("click", function (e) {
			if (!isNormalClick(e)) {
				return;
			}

			var button = findClosestByName(e.target, "BUTTON", editorToolbar);

			if (!button) {
				return;
			}

			var command = button.getAttribute("data-command");

			if (command) {
				editor.execCommand(button.getAttribute("data-command"));
			} else if (button.classList.contains("editor-link")) {
				if (button.classList.contains("selected")) {
					editor.execCommand("link:unset");
				} else {
					editor.execCommand("link:set");
				}
			} else if (button.classList.contains("editor-color")) {
				colorPalette.hidden = !colorPalette.hidden;
			} else if (button.classList.contains("editor-color-option")) {
				var color = button.children[0].style.backgroundColor;
				editor.execCommand("color:set", [color]);
			}
		});

		editor.content.tabIndex = textarea.tabIndex;

		function addRainbowOption() {
			var rainbowOptionInner = document.createElement("span");
			rainbowOptionInner.className = "editor-color-option-rainbow";

			var rainbowOption = document.createElement("button");
			rainbowOption.type = "button";
			rainbowOption.className = "editor-color-option";
			rainbowOption.title = "Rainbow";
			rainbowOption.appendChild(rainbowOptionInner);

			rainbowOption.addEventListener("click", function (e) {
				if (!isNormalClick(e)) {
					return;
				}

				e.stopPropagation();
				editor.execCommand("color:set", ["rainbow"]);
			});

			colorPalette.appendChild(rainbowOption);
		}

		function createColorLine(target) {
			var overlay = document.createElement("div");
			overlay.className = "editor-color-line-overlay";

			var canvas = document.createElement("canvas");
			canvas.className = "editor-color-line";
			canvas.width = 300;
			canvas.height = 30;

			target.parentNode.classList.add("editor-color-transform");
			target.parentNode.insertBefore(overlay, target);
			target.parentNode.insertBefore(canvas, target);

			var animation = animateSlide(canvas);

			function slideMoveListener(e) {
				if (e.buttons === 0) {
					slideUpListener(e);
					return;
				}

				var trackStart = 0;
				var offsetElement = canvas;

				do {
					trackStart += offsetElement.offsetLeft;
				} while ((offsetElement = offsetElement.offsetParent));

				animation.slide(e.clientX - trackStart);
			}

			function slideUpListener(e) {
				window.removeEventListener("mousemove", slideMoveListener);
				window.removeEventListener("mouseup", slideUpListener);

				animation.stop();

				var trackStart = 0;
				var offsetElement = canvas;

				do {
					trackStart += offsetElement.offsetLeft;
				} while ((offsetElement = offsetElement.offsetParent));

				if (animation.isComplete(e.clientX - trackStart)) {
					editorContainer.removeEventListener("mousedown", createColorLineListener);
					localStorage.setItem("rainbow", "1");
					addRainbowOption();
				}

				target.parentNode.removeChild(overlay);
				target.parentNode.removeChild(canvas);
				target.parentNode.classList.remove("editor-color-transform");
			}

			window.addEventListener("mousemove", slideMoveListener);
			window.addEventListener("mouseup", slideUpListener);
		}

		function createColorLineListener(e) {
			if (!isNormalClick(e)) {
				return;
			}

			var target = e.target;

			if (
				!target.classList.contains("editor-color-option") &&
				!(target = target.parentNode).classList.contains("editor-color-option")
			) {
				return;
			}

			if (target.parentNode.children[0] !== target) {
				return;
			}

			var down = performance.now();

			function moveListener(e) {
				if (e.buttons === 0) {
					removeListeners();
					return;
				}

				var downTime = performance.now() - down;

				if (downTime > 1000) {
					removeListeners();
					createColorLine(target);
				}
			}

			function removeListeners() {
				target.removeEventListener("mousemove", moveListener);
				window.removeEventListener("mouseup", removeListeners);
			}

			target.addEventListener("mousemove", moveListener);
			window.addEventListener("mouseup", removeListeners);
		}

		if (hasStorage) {
			if (localStorage.getItem("rainbow")) {
				addRainbowOption();
			} else {
				editorToolbar.addEventListener("mousedown", createColorLineListener);
			}
		}

		textarea.form.addEventListener("submit", function () {
			textarea.value = editor.getContent("bbcode");

			if (serializeTimer !== null) {
				clearTimeout(serializeTimer);
			}
		});

		textarea.parentNode.insertBefore(editorContainer, textarea);
		textarea.classList.add("editor-replaced");
	}

	return {
		createEditor: createEditor,
	};
});
