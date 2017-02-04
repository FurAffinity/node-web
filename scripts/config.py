#!/usr/bin/env python3

import base64
import json
import os
import string
import sys

from pathlib import Path


def toml_str(s):
	if "'" in s:
		return json.dumps(s)
	else:
		return "'{}'".format(s)


def generate_key():
	return base64.b64encode(os.urandom(32)).decode("utf-8")


class TomlFormatter(string.Formatter):
	def convert_field(self, value, conversion):
		if conversion != "t":
			return super().convert_field(value, conversion)

		if isinstance(value, bool):
			return str(value).lower()
		elif isinstance(value, int):
			return str(value)
		elif isinstance(value, str):
			return toml_str(value)
		else:
			raise TypeError("TOML formatter supports bool, int, and str, not {!r}".format(type(value).__name__))


questions = [
	("database_host", "Database host", "/var/run/postgresql"),
	("database_user", "Database user", "fa_dev"),
	("database_password", "Database password", ""),
	("database_name", "Database name", "fa"),
	("root", "Site root (no trailing slash)", "https://localhost"),
]

project_root = Path(__file__).parent.parent
config_template = project_root / "config/config.toml.template"
config_output = project_root / "config/config.toml"

overwrite = "-f" in sys.argv

if not overwrite and config_output.exists():
	if input("{} exists. Overwrite it? [y/N] ".format(config_output)) in ("y", "Y"):
		overwrite = True
	else:
		raise SystemExit(1)

with config_template.open("r") as f:
	template = f.read()

params = {}

for name, prompt, default in questions:
	params[name] = input("{}? [{}] ".format(prompt, default)) or default

formatter = TomlFormatter()
config = formatter.format(
	template,
	cookie_secure=params["root"].startswith("https:"),
	csrf_mac_key=generate_key(),
	**params,
)

with config_output.open("w" if overwrite else "wx") as f:
	f.write(config)
