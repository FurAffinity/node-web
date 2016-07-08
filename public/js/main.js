'use strict';

def('button', [], function () {
	function empty(node) {
		var child;

		while ((child = node.lastChild)) {
			node.removeChild(child);
		}
	}

	var defaultView = document.defaultView;

	function commonPrefix(a, b) {
		var l = Math.min(a.length, b.length);

		for (var i = 0; i < l; i++) {
			if (a.charAt(i) !== b.charAt(i)) {
				return a.substring(0, i);
			}
		}

		return a.substring(0, l);
	}

	function transitionButtonText(button, newText, upwards) {
		var currentTransition = button.getElementsByClassName('text-transition')[0];

		if (currentTransition) {
			button.style.width = defaultView.getComputedStyle(button).width;
			button.replaceChild(currentTransition.lastChild.firstChild, currentTransition);
		}

		var oldText = button.textContent;

		if (oldText === newText) {
			return;
		}

		var prefix = commonPrefix(oldText, newText);
		var textOut = oldText.substring(prefix.length);
		var textIn = newText.substring(prefix.length);

		var transitionContainer = document.createElement('span');
		transitionContainer.className = 'text-transition';

		var textOutElement = document.createElement('span');
		textOutElement.className = 'text-transition-out';
		textOutElement.textContent = textOut;

		var textInElement = document.createElement('span');
		textInElement.className = upwards ? 'text-transition-in text-transition-up' : 'text-transition-in';
		textInElement.textContent = textIn;

		textInElement.addEventListener('animationend', function () {
			button.style.width = defaultView.getComputedStyle(button).width;
			button.replaceChild(textInElement.firstChild, transitionContainer);
		});

		transitionContainer.appendChild(textOutElement);
		transitionContainer.appendChild(textInElement);

		button.textContent = prefix;
		button.appendChild(transitionContainer);

		transitionContainer.style.minWidth = defaultView.getComputedStyle(textInElement).width;
	}

	function fallbackReplaceButtonText(button, newText) {
		empty(button);
		button.appendChild(document.createTextNode(newText));
	}

	if (!defaultView || !defaultView.getComputedStyle) {
		return {
			transitionButtonText: fallbackReplaceButtonText,
		};
	}

	return {
		transitionButtonText: transitionButtonText,
	};
});
