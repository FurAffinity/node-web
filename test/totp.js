"use strict";

var tap = require("tap");

var totp = require("../app/totp");
var base32Encode = totp.base32Encode;

function b(byteString) {
	var bytes = [];
	var bytePattern = /\\x([\da-f]{2})|[^]/gi;
	var match;

	while ((match = bytePattern.exec(byteString.raw))) {
		if (match[1]) {
			bytes.push(parseInt(match[1], 16));
		} else {
			bytes.push(match[0].charCodeAt(0));
		}
	}

	return Buffer.from(bytes);
}

tap.test("base-32 encoding should be accurate", function (t) {
	t.plan(11);
	t.equals(base32Encode(b``), "");
	t.equals(base32Encode(b`\x00`), "AA");
	t.equals(base32Encode(b`\x01\x02`), "AEBA");
	t.equals(base32Encode(b`\x03\x04\x05`), "AMCAK");
	t.equals(base32Encode(b`\x06\x07\x08\x09`), "AYDQQCI");
	t.equals(base32Encode(b`\x11\x21\x32\x43\x55`), "CEQTEQ2V");
	t.equals(base32Encode(b`\xa1\xb1\xc2\xd3\xe5\x00`), "UGY4FU7FAA");
	t.equals(base32Encode(b`\xa8\xbd\xc5\xd2\xe7\x01\x02`), "VC64LUXHAEBA");
	t.equals(base32Encode(b`\xa9\xb0\xc9\xd9\xe2\x03\x04\x05`), "VGYMTWPCAMCAK");
	t.equals(base32Encode(b`\xab\xbd\xc8\xd5\xed\x06\x07\x08\x09`), "VO64RVPNAYDQQCI");
	t.equals(base32Encode(b`\xa2\xbf\xc1\xd0\xe1\x11\x21\x32\x43\x55`), "UK74DUHBCEQTEQ2V");
});

tap.test("hotp", function (t) {
	var key = Buffer.alloc(20, 0);

	t.plan(2);
	t.equals(totp.hotp(key, 0), "328482", "hotp should produce a correct OTP");
	t.equals(totp.hotp(key, 3198), "000529", "hotp should produce a zero-padded OTP");
});
