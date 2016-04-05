## Dependencies

- PostgreSQL 9.5
- Redis
- libvips 8.3
- Pandoc
- Node.js 5.10

## Quick start

```shellsession
$ npm install
$ sudo -u postgres createuser --superuser fa_dev
$ sudo -u postgres createdb --owner=fa_dev fa
$ scripts/config.py
$ node scripts/migrate
$ node app/server
```
