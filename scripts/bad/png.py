#!/usr/bin/env python3

import io
import struct
import zlib

from pathlib import Path


PNG_HEADER = b"\x89PNG\r\n\x1a\n"


def chunk(chunk_type, data):
	assert len(chunk_type) == 4

	return b"%s%s%s%s" % (
		len(data).to_bytes(4, "big"),
		chunk_type,
		data,
		zlib.crc32(data, zlib.crc32(chunk_type)).to_bytes(4, "big"),
	)


def compress_repeat(data, count):
	with io.BytesIO() as t:
		compress = zlib.compressobj(level=9, memLevel=9)

		for i in range(count):
			t.write(compress.compress(data))

		t.write(compress.flush())

		return t.getvalue()


iend_chunk = chunk(b"IEND", b"")
ihdr_pixel = chunk(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 1, 0, 0, 0, 0))
idat_pixel = chunk(b"IDAT", zlib.compress(b"\x00\x80"))
output_root = Path(__file__).parent
big_data = compress_repeat(2**15 * b"a", 2**15)

with (output_root / "idat-bomb.png").open("wb") as f:
	width = 2**15
	height = 2**13
	scanline = b"\x04" + (width // 8) * b"\xff"

	f.write(PNG_HEADER)
	f.write(chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 1, 0, 0, 0, 0)))
	f.write(chunk(b"IDAT", compress_repeat(scanline, height)))
	f.write(iend_chunk)

with (output_root / "iccp-bomb.png").open("wb") as f:
	f.write(PNG_HEADER)
	f.write(ihdr_pixel)

	# TODO: Use valid profile (http://www.color.org/specification/ICC1v43_2010-12.pdf)
	f.write(chunk(b"iCCP", b"a\x00\x00" + big_data))

	f.write(idat_pixel)
	f.write(iend_chunk)

# Assuming iTXt is treated the same way
with (output_root / "ztxt-bomb.png").open("wb") as f:
	f.write(PNG_HEADER)
	f.write(ihdr_pixel)
	f.write(chunk(b"zTXt", b"Comment\x00\x00" + big_data))
	f.write(idat_pixel)
	f.write(iend_chunk)
