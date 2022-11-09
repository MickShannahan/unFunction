import { BlobServiceClient } from "@azure/storage-blob";
import multipart from 'parse-multipart'
export default async function (context, req) {
    const blobStorage = BlobServiceClient.fromConnectionString(process.env.AZURE_BLOB_CONNECTION)
    context.log('Uploading to blob: ', req.query.container);
    try {
        if (!req.query.container) throw new Error('no container specified, specify in query')
        if (!req.query.fileName) throw new Error('no fileName specified, specify in query')

        const containerName = req.query.container
        const fileName = req.query.fileName
        // parse multipart
        const bodyBuffer = Buffer.from(req.body);
        const boundary = multipart.getBoundary(req.headers["content-type"]);
        const parts = multipart.Parse(bodyBuffer, boundary);

        if (parts.length <= 0) throw new Error('no File attached')
        const file = parts[0]

        const container = blobStorage.getContainerClient(containerName)

        const blockBlob = container.getBlockBlobClient(fileName)

        const response = await blockBlob.upload(file.data, file.data.length)
        return {
            status: 200,
            url: blockBlob.url
        }
    } catch (error) {
        return {
            status: 400,
            body: error.message
        }
    }
}