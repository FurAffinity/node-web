/*
 * Ignores negative values because it looks close enough!
 */

'use strict';

def('audio', ['button'], function (button) {
	function createSubmissionPlayer(submissionPlayer) {
		var SCALE_MAXIMA = 0.75;
		var MARKER_PADDING = 4;

		var submissionAudio = submissionPlayer.getElementsByClassName('submission-audio')[0];
		var submissionPlayButton = submissionPlayer.getElementsByClassName('submission-play')[0];

		var isLittleEndian = (function () {
			var u32 = new Uint32Array([1]);
			var u8 = new Uint8Array(u32.buffer);

			return u8[0] === 1;
		})();

		if (!isLittleEndian) {
			// TODO: Add endianness swap if anyone runs into this
			return;
		}

		var currentTimeMarker = document.createElement('span');
		currentTimeMarker.className = 'submission-player-time';

		var cursorTimeMarker = document.createElement('span');
		cursorTimeMarker.className = 'submission-player-time';

		var canvas = document.createElement('canvas');
		var g = canvas.getContext('2d');
		var gradient = g.createLinearGradient(0, canvas.height / 2, 0, canvas.height);

		gradient.addColorStop(0, 'rgba(32, 38, 44, 0.5)');
		gradient.addColorStop(1, '#20262c');

		function formatTime(t) {
			var minutes = t / 60 | 0;
			var seconds = (t | 0) % 60;

			return minutes + ':' + (seconds < 10 ? '0' + seconds : seconds);
		}

		function getWidth(element) {
			var computedStyle = document.defaultView.getComputedStyle(element);

			return +computedStyle.width.slice(0, -2);
		}

		function renderSamples(samples) {
			var l = samples.length / 2 | 0;
			var i;

			var height = canvas.height;
			canvas.width = l;

			var max = samples[0];
			var min = samples[1];

			for (i = 1; i < l; i++) {
				var sampleMax = samples[2 * i] * SCALE_MAXIMA;
				var sampleMean = samples[2 * i + 1];

				if (sampleMean > sampleMax) {
					sampleMax = sampleMean;
				}

				if (sampleMax > max) {
					max = sampleMax;
				}

				if (sampleMean < min) {
					min = sampleMean;
				}
			}

			var lastFill = 0;
			var selection = -1;
			var lastSelection = -1;

			function redrawAreaWithFill(left, right, currentFillExact) {
				var currentFill = currentFillExact | 0;
				var partialFill = currentFillExact - currentFill;

				g.clearRect(left, 0, right - left + 1, height);

				for (var i = left; i <= right; i++) {
					var sampleMax = samples[2 * i] * SCALE_MAXIMA;
					var sampleMean = samples[2 * i + 1];
					var displayMax = sampleMean > sampleMax ? sampleMean : sampleMax;

					var hMax = (displayMax - min) / (max - min) * height;
					var hMean = (sampleMean - min) / (max - min) * height;

					if (i < selection && (selection <= currentFill || i > currentFill)) {
						g.fillStyle = '#8eb';
						g.fillRect(i, height / 2 - hMax / 2, 1, hMax);

						g.fillStyle = 'white';
						g.fillRect(i, height / 2 - hMean / 2, 1, hMean);
					} else if (i < currentFill) {
						g.fillStyle = '#8cf';
						g.fillRect(i, height / 2 - hMax / 2, 1, hMax);

						g.fillStyle = 'white';
						g.fillRect(i, height / 2 - hMean / 2, 1, hMean);
					} else {
						g.fillStyle = 'rgba(255, 255, 255, 0.5)';
						g.fillRect(i, height / 2 - hMax / 2, 1, hMax);

						g.fillStyle = 'rgba(255, 255, 255, 0.4)';
						g.fillRect(i, height / 2 - hMean / 2, 1, hMean);

						if (i === currentFill) {
							if (i <= selection) {
								g.fillStyle = '#8eb';
								g.fillRect(i, height / 2 - hMax / 2, 1, hMax);

								g.fillStyle = 'white';
								g.fillRect(i, height / 2 - hMean / 2, 1, hMean);
							}

							g.fillStyle = 'rgba(136, 204, 255, ' + partialFill + ')';
							g.fillRect(i, height / 2 - hMax / 2, 1, hMax);

							g.fillStyle = 'rgba(255, 255, 255, ' + partialFill + ')';
							g.fillRect(i, height / 2 - hMean / 2, 1, hMean);
						}
					}
				}

				/* g.fillStyle = gradient;
				g.fillRect(left, height / 2, right - left + 1, height / 2);*/
			}

			function redrawArea(left, right) {
				var currentFillExact = submissionAudio.currentTime / submissionAudio.duration * l;
				redrawAreaWithFill(left, right, currentFillExact);
			}

			function updateSelection(newSelection) {
				selection = newSelection;

				var currentFillExact = submissionAudio.currentTime / submissionAudio.duration * l;
				var currentFill = currentFillExact | 0;

				if (lastSelection < selection) {
					if (lastSelection <= currentFill && selection > currentFill) {
						redrawAreaWithFill(0, selection, currentFillExact);
					} else {
						redrawAreaWithFill(lastSelection, selection, currentFillExact);
					}
				} else {
					if (lastSelection > currentFill && selection <= currentFill) {
						redrawAreaWithFill(0, lastSelection, currentFillExact);
					} else {
						redrawAreaWithFill(selection, lastSelection, currentFillExact);
					}
				}

				lastSelection = selection;
			}

			redrawArea(0, l - 1);

			var drawRequest = null;

			function updateMarkers() {
				if (selection === -1) {
					return;
				}

				var currentTime = submissionAudio.currentTime;
				var duration = submissionAudio.duration;
				var currentFillExact = currentTime / duration * l;

				currentTimeMarker.textContent = formatTime(currentTime);
				cursorTimeMarker.textContent = formatTime(selection / l * duration);

				var cursorTimeWidth = getWidth(cursorTimeMarker);
				var currentTimeWidth = getWidth(currentTimeMarker);
				var cursorTimeLeft = selection - cursorTimeWidth / 2;
				var currentTimeLeft = currentFillExact - currentTimeWidth / 2;

				if (currentTimeLeft + currentTimeWidth + MARKER_PADDING > cursorTimeLeft && cursorTimeLeft + cursorTimeWidth + MARKER_PADDING > currentTimeLeft) {
					if (currentFillExact < selection) {
						currentTimeLeft = cursorTimeLeft - currentTimeWidth - MARKER_PADDING;
					} else {
						currentTimeLeft = cursorTimeLeft + cursorTimeWidth + MARKER_PADDING;
					}
				}

				currentTimeMarker.style.left = currentTimeLeft + 'px';
				cursorTimeMarker.style.left = cursorTimeLeft + 'px';
			}

			function draw() {
				var currentFillExact = submissionAudio.currentTime / submissionAudio.duration * l;
				var currentFill = currentFillExact | 0;

				if (currentFill < lastFill) {
					redrawAreaWithFill(0, lastFill, currentFillExact);
				} else if (lastFill < selection && currentFill >= selection) {
					redrawAreaWithFill(0, currentFill, currentFillExact);
				} else {
					redrawAreaWithFill(lastFill, currentFill, currentFillExact);
				}

				lastFill = currentFill;

				updateMarkers();
			}

			function drawLoop() {
				draw();
				drawRequest = requestAnimationFrame(drawLoop);
			}

			canvas.addEventListener('mousemove', function (e) {
				var x = e.clientX;

				var p = canvas;

				while (p) {
					x -= p.offsetLeft;
					p = p.offsetParent;
				}

				updateSelection(x);
				updateMarkers();
			});

			canvas.addEventListener('mouseout', function () {
				updateSelection(-1);
			});

			canvas.addEventListener('mousedown', function (e) {
				if (e.button || e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) {
					return;
				}

				e.preventDefault();

				if (submissionAudio.paused) {
					lastFill = selection;
					lastSelection = -1;
					submissionAudio.currentTime = selection / l * submissionAudio.duration;
					redrawArea(0, l - 1);
					updateMarkers();
				} else {
					submissionAudio.pause();

					canvas.addEventListener('mouseup', function f() {
						canvas.removeEventListener('mouseup', f);

						if (selection !== -1) {
							submissionAudio.currentTime = selection / l * submissionAudio.duration;
							lastFill = selection;
							lastSelection = -1;
							redrawArea(0, l - 1);
							updateMarkers();
						}

						submissionAudio.play();
					});
				}
			});

			// This event also fires when the audio ends.
			submissionAudio.addEventListener('pause', function () {
				cancelAnimationFrame(drawRequest);
			});

			submissionAudio.addEventListener('playing', drawLoop);
			submissionAudio.addEventListener('ended', draw);

			var playerUI = document.createElement('div');
			playerUI.className = 'submission-player-inner';
			playerUI.appendChild(currentTimeMarker);
			playerUI.appendChild(cursorTimeMarker);
			playerUI.appendChild(canvas);

			submissionPlayer.replaceChild(playerUI, submissionAudio);
		}

		(function () {
			var waveformSource = submissionAudio.getAttribute('data-waveform');

			var request = new XMLHttpRequest();

			request.responseType = 'arraybuffer';

			request.open('GET', waveformSource, true);

			request.onreadystatechange = function () {
				if (request.readyState !== 4) {
					return;
				}

				if (request.status >= 400) {
					// TODO
					alert('Failed');
					return;
				}

				var samples = new Float32Array(request.response);
				renderSamples(samples);
			};

			request.send(null);
		})();

		submissionAudio.addEventListener('ended', function () {
			submissionPlayButton.classList.remove('playing');
			button.transitionButtonText(submissionPlayButton.lastChild, 'Play');
		});

		submissionPlayButton.addEventListener('click', function () {
			if (submissionAudio.paused) {
				submissionAudio.play();
				submissionPlayButton.classList.add('playing');
				button.transitionButtonText(submissionPlayButton.lastChild, 'Pause');
			} else {
				submissionAudio.pause();
				submissionPlayButton.classList.remove('playing');
				button.transitionButtonText(submissionPlayButton.lastChild, 'Play', true);
			}
		});
	}

	return {
		createSubmissionPlayer: createSubmissionPlayer,
	};
});
