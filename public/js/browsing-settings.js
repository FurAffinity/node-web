'use strict';

req(['button'], function (button) {
	var form = document.getElementById('browsing-settings');
	var saveButton = form.getElementsByClassName('button-apply-changes')[0];

	function changeListener() {
		form.removeEventListener('change', changeListener);

		saveButton.classList.remove('button-disabled');
		saveButton.disabled = false;
		button.transitionButtonText(saveButton, 'Save Preferences', false);
	}

	form.addEventListener('submit', function (e) {
		var data = new FormData(form);
		var request = new XMLHttpRequest();

		saveButton.classList.add('progress');
		button.transitionButtonText(saveButton, 'Saving changes…', false);

		request.addEventListener('error', function () {
			form.submit();
		});

		request.addEventListener('load', function () {
			saveButton.classList.remove('progress');
			saveButton.classList.add('button-disabled');
			saveButton.disabled = true;
			button.transitionButtonText(saveButton, 'Changes saved!', false);

			form.addEventListener('change', changeListener);
		});

		request.open('POST', '/settings/browsing', true);
		request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
		request.send(
			't=' + encodeURIComponent(data.get('t')) +
			'&rating=' + encodeURIComponent(data.get('rating'))
		);

		e.preventDefault();
	});
});
