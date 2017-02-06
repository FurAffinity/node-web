all: public/js/editor.js public/js/notifications.js

public/js/editor.js: src/js/editor.js node_modules/prosemirror
	node_modules/browserify/bin/cmd.js $< --outfile $@

public/js/notifications.js: src/js/notifications.js
	node_modules/browserify/bin/cmd.js $< --outfile $@

clean:
	rm -f public/js/editor.js

.PHONY: all clean
