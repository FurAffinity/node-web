"use strict";

def("upload", ["button", "editor"], function (button, editor) {
	var SIZE_KB = 1000;
	var SIZE_MB = 1000 * SIZE_KB;

	var TYPE_NAMES = {
		"jpg": "JPEG",
		"png": "PNG",
		"mp3": "MP3",
		"ogg": "Vorbis",
		"flac": "FLAC",
		"docx": "Word document",
		"epub": "EPUB",
	};

	function toArray(list) {
		var l = list.length;
		var result = new Array(l);

		for (var i = 0; i < l; i++) {
			result[i] = list[i];
		}

		return result;
	}

	function forEach(list, callback) {
		for (var i = 0, l = list.length; i < l; i++) {
			callback(list[i]);
		}
	}

	function cubicBezier(x1, y1, x2, y2) {
		return function (x) {
			var t = x;

			t -= (3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t - x) / (3 * (t * t * (3 * x1 - 3 * x2 + 1) + t * (2 * x2 - 4 * x1) + x1));
			t -= (3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t - x) / (3 * (t * t * (3 * x1 - 3 * x2 + 1) + t * (2 * x2 - 4 * x1) + x1));
			t -= (3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t - x) / (3 * (t * t * (3 * x1 - 3 * x2 + 1) + t * (2 * x2 - 4 * x1) + x1));
			t -= (3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t - x) / (3 * (t * t * (3 * x1 - 3 * x2 + 1) + t * (2 * x2 - 4 * x1) + x1));

			return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
		};
	}

	function toPrecision2(n) {
		if (n >= 9.95) {
			return Math.round(n).toString();
		} else {
			return n.toFixed(1);
		}
	}

	function formatFileSize(bytes) {
		if (bytes >= SIZE_MB) {
			return toPrecision2(bytes / SIZE_MB) + " MB";
		} else if (bytes >= SIZE_KB) {
			return toPrecision2(bytes / SIZE_KB) + " KB";
		} else if (bytes === 1) {
			return "1 byte";
		} else {
			return bytes + " bytes";
		}
	}

	function syncSelected(checkbox) {
		checkbox.parentNode.classList.toggle("selected", checkbox.checked);
	}

	var bounceTimingFunction = cubicBezier(0.75, 0, 1, 1);

	function BounceAnimation() {
		this.new = [];
		this.intro = [];
		this.bounce = [];
		this.animations = 0;
	}

	BounceAnimation.prototype.add = function (progressContainer) {
		var bounce = progressContainer.getElementsByClassName("upload-progress-bounce")[0];
		var hole = progressContainer.getElementsByClassName("upload-progress-hole")[0];

		this.new.push({
			bounce: bounce,
			hole: hole,
			startIteration: -1,
		});

		if (++this.animations === 1) {
			this.start();
		}
	};

	BounceAnimation.prototype.remove = function (progressContainer) {
		var bounce = progressContainer.getElementsByClassName("upload-progress-bounce")[0];
		var i;

		this.animations--;

		for (i = 0; i < this.new.length; i++) {
			if (this.new[i].bounce === bounce) {
				this.new.splice(i, 1);
				return;
			}
		}

		for (i = 0; i < this.intro.length; i++) {
			if (this.intro[i].bounce === bounce) {
				this.intro.splice(i, 1);
				return;
			}
		}

		i = this.bounce.indexOf(bounce);

		if (i === -1) {
			this.animations++;
		} else {
			this.bounce.splice(i, 1);
		}
	};

	BounceAnimation.prototype.start = function () {
		var animation = this;
		var new_ = this.new;
		var intro = this.intro;
		var bounce = this.bounce;

		var start = null;
		var duration = 0.4;

		function frame(now) {
			var t = 0;

			if (start === null) {
				start = now;
			} else {
				t = (now - start) / 1000;
			}

			var iterationCount = t / duration | 0;
			var reverse = iterationCount % 2 === 1;
			var iterationProgress = (t / duration) % 1;
			var p = bounceTimingFunction(reverse ? 1 - iterationProgress : iterationProgress);

			if (!reverse && p < 0.01 && new_.length > 0) {
				forEach(new_, function (n) {
					n.startIteration = iterationCount;
					intro.push(n);
				});

				new_.length = 0;
			}

			for (var i = 0; i < intro.length; i++) {
				var n = intro[i];

				if (iterationCount > n.startIteration) {
					n.hole.style.display = "none";
					bounce.push(n.bounce);
					intro.splice(i, 1);
					i--;
					continue;
				}

				n.hole.style.transform = "translateY(" + (p * 15) + "px) scale(" + (1 - p) + ")";
				n.bounce.style.transform = "translateY(" + (p * 15) + "px) scale(" + (1 - 0.75 * p) + ")";
			}

			forEach(bounce, function (element) {
				element.style.transform = "translateY(" + (p * 30 - 15) + "px) scale(0.25)";
			});

			if (animation.animations > 0) {
				requestAnimationFrame(frame);
			}
		}

		requestAnimationFrame(frame);
	};

	var bounceAnimation = new BounceAnimation();

	function Event() {
		this.listeners = [];
	}

	Event.prototype.listen = function listen(listener) {
		this.listeners.push(listener);
	};

	Event.prototype.trigger = function trigger(data) {
		var listeners = this.listeners;

		for (var i = 0; i < listeners.length; i++) {
			var listener = listeners[i];
			listener(data);
		}
	};

	var uploadSelected = new Event();

	function ready() {
		var uploadList = document.getElementById("upload-list");

		uploadList.addEventListener("change", function (e) {
			if (e.target.classList.contains("upload-use")) {
				uploadSelected.trigger(e.target.parentNode);
			}
		});

		uploadSelected.listen(function (upload) {
			forEach(uploadList.getElementsByClassName("upload-use"), syncSelected);

			var uploadThumbnail = upload.getElementsByClassName("upload-thumbnail")[0];

			forEach(document.getElementsByClassName("folder-new-submission"), function (folderNewSubmission) {
				folderNewSubmission.src = uploadThumbnail.src;
			});
		});

		uploadList.addEventListener("mousedown", function (e) {
			if (!e.button && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey) {
				e.preventDefault();
			}
		});

		forEach(uploadList.getElementsByClassName("upload-use"), syncSelected);

		var uploadFile = document.getElementById("upload-file");
		var uploadBox = uploadFile.parentNode;
		var uploadButton = uploadBox.getElementsByClassName("button")[0];
		var uploadTemplate = document.getElementById("upload-template");
		var uploadCsrfToken = uploadFile.getAttribute("data-csrf");
		var insertUploadsAfter = uploadTemplate.previousSibling;

		uploadTemplate.parentNode.removeChild(uploadTemplate);

		function deselectAll() {
			forEach(uploadList.getElementsByClassName("upload-use"), function (use) {
				if (use.parentNode === uploadTemplate) {
					return;
				}

				use.checked = false;
				syncSelected(use);
			});
		}

		var isOver = false;
		var clearOverTimer = null;

		window.addEventListener("dragover", function (e) {
			if (clearOverTimer) {
				clearTimeout(clearOverTimer);
				clearOverTimer = null;
			}

			if (isOver) {
				return;
			}

			isOver = true;

			var fileCount = null;

			if (e.dataTransfer.files) {
				fileCount = e.dataTransfer.files.length;
			} else if ("mozItemCount" in e.dataTransfer) {
				fileCount = e.dataTransfer.mozItemCount;
			}

			if (fileCount !== 0) {
				uploadBox.classList.add("upload-drag");

				var buttonText =
					fileCount === null ?
						"Drop files" :
						"Drop " + fileCount + (fileCount === 1 ? " file" : " files");

				button.transitionButtonText(uploadButton, buttonText, false);
			}
		});

		function clearOver() {
			isOver = false;
			uploadBox.classList.remove("upload-drag");
			button.transitionButtonText(uploadButton, "Upload file", true);
		}

		window.addEventListener("dragleave", function () {
			if (clearOverTimer) {
				clearTimeout(clearOverTimer);
			}

			clearOverTimer = setTimeout(clearOver, 200);
		});

		function uploadBoxDrag(e) {
			e.dataTransfer.dropEffect = "copy";
			e.preventDefault();
		}

		uploadBox.addEventListener("dragenter", uploadBoxDrag);
		uploadBox.addEventListener("dragover", uploadBoxDrag);

		uploadBox.addEventListener("drop", function (e) {
			e.preventDefault();

			if (clearOverTimer) {
				clearTimeout(clearOverTimer);
			}

			clearOver();

			uploadFiles(e.dataTransfer.files);
		});

		function uploadFiles(fileList) {
			if (fileList.length === 0) {
				return;
			}

			var files = toArray(fileList);
			var data = new FormData();
			var request = new XMLHttpRequest();

			var uploads = [];

			data.append("t", uploadCsrfToken);

			forEach(files, function (file) {
				data.append("file", file, file.name);

				var newUpload = uploadTemplate.cloneNode(true);
				newUpload.removeAttribute("id");
				newUpload.setAttribute("aria-hidden", "false");

				var uploadFilename = newUpload.getElementsByClassName("upload-filename")[0];
				uploadFilename.textContent = file.name;
				uploadFilename.title = file.name;

				var uploadFileDetails = newUpload.getElementsByClassName("upload-file-details")[0];
				uploadFileDetails.textContent = "0%";

				insertUploadsAfter.parentNode.insertBefore(newUpload, insertUploadsAfter.nextSibling);

				request.upload.addEventListener("progress", function progressListener(e) {
					var progress = e.loaded / e.total;

					uploadFileDetails.textContent = (progress * 100 | 0) + "%";
					updateProgress(newUpload, progress);

					if (e.loaded === e.total) {
						request.upload.removeEventListener("progress", progressListener);
					}
				});

				uploads.push(newUpload);
			});

			deselectAll();

			var use = uploads[uploads.length - 1].getElementsByClassName("upload-use")[0];
			use.checked = true;
			syncSelected(use);

			function displayUploadError(upload, errorText) {
				bounceAnimation.remove(upload);

				upload.classList.remove("selected");
				upload.classList.add("upload-error");

				var uploadUse = upload.getElementsByClassName("upload-use")[0];
				var uploadFileDetails = upload.getElementsByClassName("upload-file-details")[0];

				uploadUse.checked = false;
				uploadUse.disabled = true;

				uploadFileDetails.textContent = errorText;
			}

			function displayUploadInfo(upload, uploadInfo, thumbnailUrl, fileId) {
				bounceAnimation.remove(upload);

				var uploadProgress = upload.getElementsByClassName("upload-progress")[0];
				var uploadUse = upload.getElementsByClassName("upload-use")[0];
				var uploadFileDetails = upload.getElementsByClassName("upload-file-details")[0];

				var uploadThumbnail = document.createElement("img");
				uploadThumbnail.className = "upload-thumbnail";
				uploadThumbnail.src = thumbnailUrl;
				upload.replaceChild(uploadThumbnail, uploadProgress);

				uploadUse.name = "id";
				uploadUse.value = fileId;

				uploadFileDetails.textContent = uploadInfo;
			}

			request.responseType = "json";

			request.addEventListener("load", function () {
				var response = request.response;

				if (response === null) {
					forEach(uploads, function (upload) {
						displayUploadError(upload, "An unknown error occurred");
					});

					return;
				}

				for (var i = 0; i < uploads.length; i++) {
					var upload = uploads[i];
					var inputFile = files[i];
					var storedFile = response[i];

					if (storedFile.error) {
						displayUploadError(upload, storedFile.error);
						continue;
					}

					var uploadInfo = TYPE_NAMES[storedFile.upload_type] + ", " + formatFileSize(inputFile.size);

					var thumbnail = storedFile.thumbnail;
					var thumbnailUrl =
						thumbnail ?
							"/files/" + thumbnail :
							"/images/default-thumbnail.svg";

					displayUploadInfo(upload, uploadInfo, thumbnailUrl, storedFile.id);
				}
			});

			request.addEventListener("error", function () {
				forEach(uploads, function (upload) {
					displayUploadError(upload, "A network error occurred");
				});
			});

			request.open("POST", "/api/submissions/upload", true);
			request.send(data);
		}

		uploadFile.addEventListener("change", function () {
			uploadFiles(uploadFile.files);
		});

		var newFolder = document.getElementById("new-folder");
		var newFolderUse = newFolder.children[0];
		var newFolderName = newFolder.getElementsByClassName("text")[0];

		newFolderUse.addEventListener("change", function () {
			if (!newFolderUse.checked) {
				newFolderName.value = "";
			} else if (newFolderName.value === "") {
				newFolderName.value = "New folder";
			}
		});

		newFolderName.addEventListener("input", function () {
			newFolderUse.checked = newFolderName.value !== "";
		});

		newFolderUse.checked = newFolderName.value !== "";

		var folderList = newFolder.parentNode;

		folderList.addEventListener("mousedown", function (e) {
			var folderNewSubmission = e.target;

			if (e.button || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || !folderNewSubmission.classList.contains("folder-new-submission")) {
				return;
			}

			var folderSubmissions = Array.prototype.slice.call(folderNewSubmission.parentNode.getElementsByTagName("img"), 0, -1);
			var itemDistance = 4.3 * 16;
			var itemWidth = folderNewSubmission.offsetWidth;
			var scrollWidth = folderNewSubmission.parentNode.offsetWidth;
			var traversableWidth = folderNewSubmission.parentNode.parentNode.offsetWidth - itemDistance;
			var leftOverflow = scrollWidth - folderNewSubmission.parentNode.parentNode.offsetWidth;

			var startX = e.clientX;
			var initialOffset =
				folderNewSubmission.style.left ?
					+folderNewSubmission.style.left.slice(0, -2) :
					0;

			var k = leftOverflow / traversableWidth;

			function constrain(value, min, max) {
				if (value < min) {
					return min;
				} else if (value > max) {
					return max;
				} else {
					return value;
				}
			}

			function arrangeElements(moveDistance, snap) {
				var newLeft = constrain(initialOffset + moveDistance * (1 + k), -scrollWidth + itemWidth, 0);
				var newSlide = -newLeft * k / (1 + k);

				var targetPosition = folderSubmissions.length + (newLeft / itemDistance - 0.5 | 0);

				var i;

				for (i = folderSubmissions.length - 1; i >= targetPosition; i--) {
					folderSubmissions[i].style.left = itemDistance + "px";
				}

				for (; i >= 0; i--) {
					folderSubmissions[i].style.left = "";
				}

				folderNewSubmission.parentNode.style.left = newSlide + "px";
				folderNewSubmission.style.left =
					snap ?
						(targetPosition - folderSubmissions.length) * itemDistance + "px" :
						newLeft + "px";

				return targetPosition;
			}

			function moveListener(e) {
				if (e.buttons === 0) {
					upListener(null);
					return;
				}

				arrangeElements(e.clientX - startX);
			}

			function upListener(e) {
				window.removeEventListener("mousemove", moveListener);
				window.removeEventListener("mouseup", upListener);

				folderNewSubmission.classList.remove("dragging");

				console.log(arrangeElements(e ? e.clientX - startX : 0, true));
			}

			window.addEventListener("mousemove", moveListener);
			window.addEventListener("mouseup", upListener);

			folderNewSubmission.parentNode.parentNode.classList.add("dragging");

			e.preventDefault();
		});

		var uploadDescription = document.getElementById("upload-description");
		editor.createEditor(uploadDescription);
	}

	function updateProgress(upload, progress) {
		var progressContainer = upload.getElementsByClassName("upload-progress")[0];
		var progressLeft = progressContainer.children[0];
		var progressLeftCover = progressContainer.children[1];
		var progressRight = progressContainer.children[2];
		var progressRightCover = progressContainer.children[3];
		var uploadFileDetails = upload.getElementsByClassName("upload-file-details")[0];

		if (progress >= 1) {
			var progressBounce = document.createElement("div");
			progressBounce.className = "upload-progress-bounce";
			progressContainer.removeChild(progressLeft);
			progressContainer.removeChild(progressLeftCover);
			progressContainer.removeChild(progressRight);
			progressContainer.removeChild(progressRightCover);
			progressContainer.insertBefore(progressBounce, progressContainer.firstChild);
			bounceAnimation.add(progressContainer);
		} else if (progress > 0.5) {
			progressLeftCover.style.display = "";
			progressLeftCover.style.transform = "rotate(" + (progress - 0.5) * 360 + "deg)";
			progressRightCover.style.display = "none";
		} else {
			progressLeftCover.style.display = "";
			progressLeftCover.style.transform = "";
			progressRightCover.style.display = "";
			progressRightCover.style.transform = "rotate(" + progress * 360 + "deg)";
		}

		uploadFileDetails.textContent = (progress * 100 | 0) + "%";
	}

	return {
		ready: ready,
	};
});
