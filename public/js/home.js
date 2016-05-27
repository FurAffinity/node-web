"use strict";

(function () {
	var hideCsrfToken = document.documentElement.getAttribute("data-hide-csrf");

	if (!hideCsrfToken) {
		return;
	}

	function setSubmissionHidden(submissionId, action) {
		var request = new XMLHttpRequest();

		request.open("POST", "/api/submissions/" + submissionId + "/" + action, true);
		request.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
		request.send("t=" + encodeURIComponent(hideCsrfToken));
	}

	var makeThumbnailReplacement = (function () {
		var t = document.createElement("div");
		t.className = "thumbnail-replacement";

		var h = document.createElement("header");
		h.appendChild(document.createTextNode("Item hidden."));

		var d = document.createElement("p");
		d.appendChild(document.createTextNode("This submission won’t show up when browsing in the future."));

		var a = document.createElement("div");
		var u = document.createElement("button");
		u.className = "button";
		u.appendChild(document.createTextNode("Undo"));
		a.appendChild(u);

		t.appendChild(h);
		t.appendChild(d);
		t.appendChild(a);

		return function (undo) {
			var c = t.cloneNode(true);
			var cu = c.getElementsByTagName("button")[0];

			cu.addEventListener("click", undo);

			return c;
		};
	})();

	document.addEventListener("mousedown", function (e) {
		if (e.button || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || !e.target.classList.contains("thumbnail-image")) {
			return;
		}

		var thumbnailImage = e.target;
		var thumbnail = thumbnailImage.parentNode.parentNode.parentNode;
		var submissionId = thumbnail.getAttribute("data-id") | 0;

		/* needs pushpins
		if (thumbnail.classList.contains("thumbnail-favorite")) {
			return;
		}
		*/

		function hideSubmission() {
			var replacement = makeThumbnailReplacement(function undo() {
				setSubmissionHidden(submissionId, "unhide");

				thumbnail.replaceChild(thumbnailImage.parentNode.parentNode, replacement);
				thumbnail.classList.remove("thumbnail-replaced");
			});

			setSubmissionHidden(submissionId, "hide");

			thumbnail.replaceChild(replacement, thumbnailImage.parentNode.parentNode);
			thumbnail.classList.add("thumbnail-replaced");
		}

		var startY = e.clientY;

		function moveListener(e) {
			if (e.buttons === 0) {
				upListener(null);
				return;
			}

			var dy = e.clientY - startY;

			if (dy < 0) {
				dy = 0;
			}

			thumbnailImage.style.top = dy + "px";
		}

		function upListener(e) {
			window.removeEventListener("mousemove", moveListener);
			window.removeEventListener("mouseup", upListener);

			thumbnailImage.style.top = "";
			thumbnail.classList.remove("thumbnail-removing");

			if (e && e.clientY - startY > 20) {
				hideSubmission();
			}
		}

		window.addEventListener("mousemove", moveListener);
		window.addEventListener("mouseup", upListener);

		thumbnail.classList.add("thumbnail-removing");

		e.preventDefault();
	});
})();
