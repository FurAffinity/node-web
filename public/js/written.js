'use strict';

def('written', [], function () {
	var hasStorage = (function () {
		try {
			localStorage.setItem('_test', '1');
			localStorage.removeItem('_test');
			return true;
		} catch (e) {
			return false;
		}
	})();

	function setTextOption(element, property, value) {
		element.style[property] = value;

		if (hasStorage) {
			localStorage.setItem(property, value);
		}
	}

	function toCssName(property) {
		return property
			.replace(/[A-Z]/g, '-$&')
			.toLowerCase();
	}

	function findClosest(element, class_, container) {
		while (element !== container) {
			if (element.classList.contains(class_)) {
				return element;
			}

			element = element.parentNode;
		}

		if (container.classList.contains(class_)) {
			return container;
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

	function addListeners(submissionMain) {
		function clickOption(option) {
			var optionList = option.parentNode;
			var text = findClosest(optionList, 'submission-text-container', submissionMain).getElementsByClassName('submission-text')[0];
			setTextOption(text, optionList.getAttribute('data-property'), option.getAttribute('data-value'));

			var currentlySelected = optionList.getElementsByClassName('selected')[0];
			currentlySelected.classList.remove('selected');
			option.classList.add('selected');
			optionList.hidden = true;
			var tools = findClosest(optionList, 'submission-text-tools-container', submissionMain);
			tools.classList.remove('open');
			tools.currentlyOpen = null;
		}

		function clickTextOptionSelect(target) {
			var optionList = target.nextElementSibling;
			var open = optionList.hidden;
			optionList.hidden = !open;

			var tools = findClosest(target, 'submission-text-tools-container', submissionMain);

			if (open) {
				if (tools.currentlyOpen) {
					tools.currentlyOpen.hidden = true;
				}

				tools.currentlyOpen = optionList;
			} else {
				tools.currentlyOpen = null;
			}

			tools.classList.toggle('open', open);
		}

		submissionMain.addEventListener('click', function (e) {
			if (!isNormalClick(e)) {
				return;
			}

			if (e.target.classList.contains('text-option')) {
				clickOption(e.target);
			} else {
				var target = findClosest(e.target, 'text-option-select', submissionMain);

				if (target !== null) {
					clickTextOptionSelect(target);
				}
			}
		});
	}

	if (hasStorage) {
		var textOptions = ['fontFamily', 'fontSize'];
		var stylesheetProperties = [];

		textOptions.forEach(function (property) {
			var value = localStorage.getItem(property);

			if (value !== null) {
				stylesheetProperties.push(toCssName(property) + ': ' + value + ';');
			}
		});

		if (stylesheetProperties.length !== 0) {
			var stylesheet = document.createElement('style');

			stylesheet.appendChild(
				document.createTextNode(
					'.submission-text {' + stylesheetProperties.join('') + '}'
				)
			);

			document.head.appendChild(stylesheet);
		}
	}

	return {
		addListeners: addListeners,
	};
});
