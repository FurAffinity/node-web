'use strict';

var dateFormat = require('../../app/date-format');
var types = require('../../app/files/types');

function forEach(collection, action) {
	var length = collection.length;

	for (var i = 0; i < length; i++) {
		action(collection[i]);
	}
}

function groupWhere(collection, equal) {
	if (collection.length === 0) {
		return [];
	}

	var last = collection[0];
	var group = [last];
	var groups = [group];

	for (var i = 1, l = collection.length; i < l; i++) {
		var item = collection[i];

		if (equal(last, item)) {
			group.push(item);
		} else {
			group = [item];
			groups.push(group);
			last = item;
		}
	}

	return groups;
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

function mapFragment(collection, func) {
	var result = document.createDocumentFragment();

	for (var i = 0, l = collection.length; i < l; i++) {
		result.appendChild(func(collection[i]));
	}

	return result;
}

function toArray(collection) {
	var length = collection.length;
	var result = new Array(length);

	for (var i = 0; i < length; i++) {
		result[i] = collection[i];
	}

	return result;
}

function clear(node) {
	var child;

	while ((child = node.lastChild)) {
		node.removeChild(child);
	}
}

function unwrap(element) {
	var contents = document.createDocumentFragment();

	while (element.childNodes.length !== 0) {
		contents.appendChild(element.firstChild);
	}

	element.parentNode.replaceChild(contents, element);
}

function unlink(element) {
	var links = toArray(element.getElementsByTagName('a'));
	forEach(links, unwrap);
}

function pluralize(template, count) {
	return template
		.replace(/\{(.*?)\|(.*?)}/g, count === 1 ? '$1' : '$2')
		.replace(/#/g, count);
}

function Only(className, initial) {
	this.current = initial;
	this.className = className;
}

Only.find = function (className, container) {
	return new Only(className, container.getElementsByClassName(className)[0]);
};

Only.prototype.set = function (new_) {
	if (this.current === new_) {
		return false;
	}

	this.current.classList.remove(this.className);
	new_.classList.add(this.className);
	this.current = new_;

	return true;
};

function main() {
	var sidebar = document.getElementById('notifications').getElementsByClassName('sidebar-inner')[0];
	var sidebarContent = sidebar.getElementsByClassName('sidebar-content')[0];
	var navigationCurrent = Only.find('navigation-current', sidebar);
	var notificationsLink = document.getElementById('notifications-link');

	if (!notificationsLink) {
		return;
	}

	notificationsLink.addEventListener('click', function (e) {
		if (!isNormalClick(e)) {
			return;
		}

		document.body.classList.toggle('sidebar-visible');
		e.preventDefault();
	});

	function navigationItemActivated(e) {
		if (!isNormalClick(e)) {
			return;
		}

		navigationCurrent.set(this);
		e.preventDefault();
	}

	forEach(sidebar.getElementsByClassName('navigation-item'), function (navigationItem) {
		navigationItem.addEventListener('click', navigationItemActivated);
	});

	var headerActions = {
		submission: 'posted {a|#} submission{|s}',
		'submission-update': 'updated {a|#} submission{|s}',
	};

	var NON_CANONICAL_USERNAME_CHARACTER = /_/g;

	function getCanonicalUsername(displayUsername) {
		return (
			displayUsername
				.replace(NON_CANONICAL_USERNAME_CHARACTER, '')
				.toLowerCase()
		);
	}

	function createGroupHeader(group) {
		var common = group[0];
		var action = headerActions[common.type];

		var sourceLink = document.createElement('a');
		sourceLink.href = '/users/' + common.source.id + '/' + getCanonicalUsername(common.source.displayUsername);
		sourceLink.appendChild(document.createTextNode(common.source.displayUsername));

		var time = new Date(common.time);

		var timeElement = document.createElement('time');
		timeElement.dateTime = common.time;
		timeElement.title = dateFormat.local(time);
		timeElement.appendChild(document.createTextNode(dateFormat.relative(time)));

		var header = document.createElement('div');
		header.className = 'notification-group-header';
		header.appendChild(sourceLink);
		header.appendChild(document.createTextNode(' ' + pluralize(action, group.length) + ' '));
		header.appendChild(timeElement);

		return header;
	}

	var request = new XMLHttpRequest();

	request.open('GET', '/notifications', true);
	request.setRequestHeader('Accept', 'application/json');
	request.responseType = 'json';

	request.addEventListener('load', function () {
		var notificationGroups = groupWhere(request.response.notifications, function (a, b) {
			return (
				a.source.id === b.source.id &&
				a.type === b.type
			);
		});

		var fragment = mapFragment(notificationGroups, function (group) {
			var groupElement = document.createElement('div');
			groupElement.className = 'notification-group';

			groupElement.appendChild(createGroupHeader(group));
			groupElement.appendChild(
				mapFragment(group, function (notification) {
					var thumbnailContainer = null;
					var submission = notification.submission;

					if (submission.thumbnail) {
						var thumbnail = document.createElement('img');
						thumbnail.className = 'notification-thumbnail';
						thumbnail.src = '/files/' + submission.thumbnail.hash + '.' + types.byId(submission.thumbnail.type).extension;
						thumbnail.alt = '';

						thumbnailContainer = document.createElement('div');
						thumbnailContainer.className = 'notification-thumbnail-container rating-' + submission.rating;
						thumbnailContainer.appendChild(thumbnail);
					}

					var title = document.createElement('div');
					title.className = 'notification-title';
					title.appendChild(document.createTextNode(submission.title));

					var description = document.createElement('div');
					description.className = 'notification-description';
					description.innerHTML = submission.description.excerpt;
					unlink(description);

					var info = document.createElement('div');
					info.className = 'notification-info';
					info.appendChild(title);
					info.appendChild(description);

					var element = document.createElement('a');
					element.className = 'notification';
					element.href = '/submissions/' + submission.id;

					if (thumbnailContainer) {
						element.appendChild(thumbnailContainer);
					}

					element.appendChild(info);

					return element;
				})
			);

			return groupElement;
		});

		clear(sidebarContent);
		sidebarContent.appendChild(fragment);
	});

	request.send(null);
}

main();
