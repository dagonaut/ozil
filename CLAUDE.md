# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Ozil** is a personal dog activity tracking app — named after the dog. It tracks activities such as eating, pooping, peeing, and other events throughout the day. It is unrelated to MxToolbox.

## Architecture

- **Hosting:** Static site on AWS S3 behind CloudFront (private bucket, OAC)
- **Frontend:** AngularJS 1.x (HTML/CSS/JS, no build step)
- **Backend:** Node.js Lambda + API Gateway — reads/writes a single `data.json` file in S3
- **Data:** Flat JSON array stored in S3; no database
- **Infrastructure:** All AWS resources defined in CloudFormation YAML templates

## Activity Types

| Button | Code | Meaning | Row Background |
|--------|------|---------|----------------|
| T | Pee | Urine | Yellow |
| 2 | Poop | Defecation | Brown |
| D | Eat | Food/water | Green |
| Other | Other | Custom note | White |

## UI Behavior

- **Time:** defaults to "Now" — timestamp is captured at the moment of submission, not page load. An optional "Custom Time" toggle reveals date/time pickers pre-filled with the current time.
- **Multi-select:** activity buttons (T, 2, D, Other) toggle on/off; multiple can be selected at once. Submitting creates one entry per selected activity with the same timestamp.
- **"Other":** when selected, reveals a free-text note field.
- **Entry list:** grouped by day with a date header (Today / Yesterday / day name). Within each day, entries are sorted newest-first. Individual date is not shown on each row.
- **Row styling:** full-width background color per activity type, thick dark border between rows.
- **Delete:** red X button on each row; deletes that entry immediately.
- **No authentication:** open access, shared between phones, persistent via the shared S3-backed API.

## Entry Schema

```json
{
  "id": "<uuid>",
  "date": "YYYY-MM-DD",
  "time": "HH:MM",
  "activity": "T" | "2" | "D" | "Other",
  "note": ""
}
```

## Project Structure

```
cloudformation/
  hosting.yaml   # ACM cert (ozil.cc + api.ozil.cc), S3 site bucket, CloudFront, Route53
  api.yaml       # Data S3 bucket, Lambda, HTTP API Gateway, Route53 for api.ozil.cc
lambda/
  index.js       # Readable source — keep in sync with ZipFile block in api.yaml
app/
  index.html     # AngularJS single-page app
  app.js         # AngularJS module + controller
  styles.css     # Mobile-friendly styles
```

## Deployment Details

- **Region:** us-east-1
- **Domain:** ozil.cc (HTTPS via CloudFront + ACM)
- **Static site bucket:** `ozil-site` (served via CloudFront OAC, not public)
- **Data bucket:** `ozil-tracking` (stores `data.json`, private, Lambda access only)
- **API:** HTTP API Gateway v2 at `https://api.ozil.cc`
- **Default view:** entries from the last 3 days

## Deployment Steps

**Prerequisites:** Route 53 hosted zone for ozil.cc. Find the Hosted Zone ID in the AWS console.

**1. Deploy hosting stack (creates cert + CloudFront):**
```bash
aws cloudformation deploy \
  --template-file cloudformation/hosting.yaml \
  --stack-name ozil-hosting \
  --parameter-overrides HostedZoneId=<ZONE_ID> \
  --region us-east-1
```
ACM DNS validation runs automatically (may take a few minutes).

**2. Deploy API stack:**
```bash
aws cloudformation deploy \
  --template-file cloudformation/api.yaml \
  --stack-name ozil-api \
  --parameter-overrides HostedZoneId=<ZONE_ID> \
  --capabilities CAPABILITY_NAMED_IAM \
  --region us-east-1
```

**3. Upload frontend:**
```bash
aws s3 sync app/ s3://ozil-site/ --delete --region us-east-1
```

**Updating Lambda code** (without redeploying the full stack):
```bash
zip -j lambda.zip lambda/index.js
aws lambda update-function-code --function-name ozil-tracker \
  --zip-file fileb://lambda.zip --region us-east-1
```

## CI/CD

`.github/workflows/deploy.yml` runs on every push to `main`. Steps in order:
1. Deploy `cloudformation/hosting.yaml` (no-op if unchanged)
2. Deploy `cloudformation/api.yaml` (no-op if unchanged)
3. Zip and push `lambda/index.js` to the Lambda function directly — this is the authoritative Lambda source, overriding whatever the CFN ZipFile bootstrap deployed
4. Sync `app/` to `s3://ozil-site/`
5. Invalidate the CloudFront distribution (`/*`)

**Required GitHub secrets:**

| Secret | Value |
|--------|-------|
| `AWS_ACCESS_KEY_ID` | IAM user access key |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key |
| `HOSTED_ZONE_ID` | Route 53 Hosted Zone ID for ozil.cc |

The IAM user needs permissions for: CloudFormation, S3, Lambda, ACM, CloudFront, Route 53, and IAM (for `CAPABILITY_NAMED_IAM`). Using `AdministratorAccess` is simplest for a personal project.

## Notes

- The `.gitignore` is Visual Studio / .NET flavored from repo init; it can be replaced.
- No build step — `app/` is plain HTML/CSS/JS deployed directly to S3.
- `lambda/index.js` is the source of truth for Lambda code. The `ZipFile` block in `api.yaml` is only a bootstrap for the initial stack creation and does not need to be kept in sync — the CI/CD action always deploys from `lambda/index.js`.
