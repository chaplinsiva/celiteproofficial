import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const S3_ENDPOINT = process.env.S3_ENDPOINT!;
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID!;
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY!;
const PUBLIC_URL_S3 = process.env.PUBLIC_URL_S3 || process.env.NEXT_PUBLIC_S3_URL!;

const r2Client = new S3Client({
    region: "auto",
    endpoint: S3_ENDPOINT,
    credentials: {
        accessKeyId: S3_ACCESS_KEY_ID,
        secretAccessKey: S3_SECRET_ACCESS_KEY,
    },
});

const BUCKET_NAME = "celitepro";

export async function uploadToR2(
    file: Buffer,
    path: string,
    contentType: string
): Promise<string> {
    const command = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: path,
        Body: file,
        ContentType: contentType,
    });

    await r2Client.send(command);

    // Return public URL
    return `${PUBLIC_URL_S3}/${path}`;
}

export { r2Client, BUCKET_NAME };
