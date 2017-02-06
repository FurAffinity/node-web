## Dependencies

- PostgreSQL
- Redis
- libvips
- Pandoc
- Node.js
- libqrencode (with tools)

## Quick start

```shellsession
$ npm install --sharp-cxx11=1
$ sudo -u postgres createuser --superuser fa_dev
$ sudo -u postgres createdb --owner=fa_dev fa
$ scripts/config.py
$ node scripts/migrate
$ node app/server
```
