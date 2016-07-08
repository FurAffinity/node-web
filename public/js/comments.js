'use strict';

def('comments', ['editor'], function (editor) {
	function findClosest(element, class_) {
		do {
			if (element.classList.contains(class_)) {
				return element;
			}

			element = element.parentNode;
		} while (element);

		return null;
	}

	var replyForm = null;

	function ready() {
		var newComment = document.getElementById('new-comment');

		replyForm = newComment.cloneNode(true);
		replyForm.id = null;

		var replyText = replyForm.getElementsByTagName('textarea')[0];
		replyText.value = '';
		editor.createEditor(replyText);

		var newCommentText = newComment.getElementsByTagName('textarea')[0];
		editor.createEditor(newCommentText);
	}

	function collapseContainingComment(target) {
		var comment = findClosest(target, 'comment');
		var collapsed = comment.classList.toggle('comment-collapsed');

		target.textContent =
			collapsed ?
				'expand' :
				'collapse';
	}

	function replyContainingComment(replyLink) {
		replyForm.action = replyLink.getAttribute('href');

		if (!replyLink.classList.toggle('replying')) {
			replyLink.textContent = 'reply';
			replyForm.parentNode.removeChild(replyForm);
			return;
		}

		var previousComment = findClosest(replyForm, 'comment');

		if (previousComment) {
			var previousReplyLink = previousComment.getElementsByClassName('replying')[0];
			previousReplyLink.classList.remove('replying');
			previousReplyLink.textContent = 'reply';
		}

		var comment = findClosest(replyLink, 'comment');
		comment.appendChild(replyForm);

		replyLink.textContent = 'cancel';
	}

	document.addEventListener('click', function (e) {
		if (e.target.classList.contains('comment-action-collapse')) {
			collapseContainingComment(e.target);
		} else if (e.target.classList.contains('comment-action-reply')) {
			replyContainingComment(e.target);
		} else {
			return;
		}

		e.preventDefault();
	});

	return {
		ready: ready,
	};
});
