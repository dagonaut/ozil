# Ozil

A dog activity tracker for Ozil. Logs eat, pee, poop, and custom events with timestamps. Built as a mobile-friendly web app with no login — shared between household phones.

**Live:** https://ozil.cc

## Stack

- **Frontend:** AngularJS 1.x static site on S3 + CloudFront
- **Backend:** Node.js Lambda + HTTP API Gateway
- **Data:** Single `data.json` file in S3 (no database)
- **Infrastructure:** CloudFormation YAML

## Development

No build step. Edit files in `app/` directly, then serve locally:

```bash
cd app && python -m http.server 8080
```

The app will call the live API at `https://api.ozil.cc`. Push to `main` to deploy via GitHub Actions.

## Deployment

See `CLAUDE.md` for full deployment steps and AWS resource details.
