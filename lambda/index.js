// Ozil Dog Tracker — Lambda handler
// Readable source. Keep in sync with the ZipFile block in cloudformation/api.yaml.
// To deploy updates: zip -j lambda.zip lambda/index.js
//   aws lambda update-function-code --function-name ozil-tracker --zip-file fileb://lambda.zip --region us-east-1

const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { randomUUID } = require('crypto');

const s3 = new S3Client({});
const BUCKET = process.env.DATA_BUCKET;
const KEY = 'data.json';
const JSON_CT = { 'Content-Type': 'application/json' };

async function getData() {
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: KEY }));
    return JSON.parse(await r.Body.transformToString());
  } catch (e) {
    if (e.name === 'NoSuchKey') return [];
    throw e;
  }
}

async function putData(data) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: KEY,
    Body: JSON.stringify(data),
    ContentType: 'application/json',
  }));
}

exports.handler = async (event) => {
  const { method, path } = event.requestContext.http;

  try {
    if (method === 'GET' && path === '/entries') {
      return { statusCode: 200, headers: JSON_CT, body: JSON.stringify(await getData()) };
    }

    if (method === 'POST' && path === '/entries') {
      const b = JSON.parse(event.body);
      const entry = {
        id: randomUUID(),
        date: b.date,
        time: b.time,
        activity: b.activity,
        note: b.note || '',
      };
      const data = await getData();
      data.unshift(entry);
      await putData(data);
      return { statusCode: 201, headers: JSON_CT, body: JSON.stringify(entry) };
    }

    if (method === 'DELETE') {
      const id = path.split('/').pop();
      const data = (await getData()).filter(e => e.id !== id);
      await putData(data);
      return { statusCode: 200, headers: JSON_CT, body: JSON.stringify({ deleted: id }) };
    }

    return { statusCode: 404, headers: JSON_CT, body: '{"error":"Not found"}' };
  } catch (e) {
    console.error(e);
    return { statusCode: 500, headers: JSON_CT, body: '{"error":"Internal server error"}' };
  }
};
