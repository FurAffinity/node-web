"use strict";

def("comments", ["editor"], function (editor) {
	function findClosest(element, class_) {
		do {
			if (element.classList.contains(class_)) {
				return element;
			}

			element = element.parentNode;
		} while (element);

		return null;
	}

	function ready() {
		var newComment = document.getElementById("new-comment");
		var newCommentText = newComment.getElementsByTagName("textarea")[0];

		editor.createEditor(newCommentText);
	}

	document.addEventListener("click", function (e) {
		if (e.target.classList.contains("comment-action-collapse")) {
			var comment = findClosest(e.target, "comment");
			var collapsed = comment.classList.toggle("comment-collapsed");

			e.target.textContent =
				collapsed ?
					"expand" :
					"collapse";
		}
	});

	return {
		ready: ready,
	};
});
