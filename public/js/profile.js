(function () {
	"use strict";

	function getHeight(element) {
		var computedStyle = document.defaultView.getComputedStyle(element);

		return +computedStyle.height.slice(0, -2);
	}

	var full = document.getElementById("profile-text-full");

	if (full === null) {
		return;
	}

	var profileText = full.parentNode;
	var readMore = document.createElement("a");
	readMore.id = "profile-text-read-more";
	readMore.href = "#";
	readMore.textContent = "Read more";

	readMore.addEventListener("click", function (e) {
		e.preventDefault();

		var originalHeight = getHeight(profileText);

		readMore.textContent =
			profileText.classList.toggle("open") ?
				"Read less" :
				"Read more";

		var newHeight = getHeight(profileText);

		window.scrollBy(0, newHeight - originalHeight);
	});

	profileText.classList.remove("open");
	profileText.appendChild(readMore);
})();
