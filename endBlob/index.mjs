import { BlobServiceClient } from "@azure/storage-blob";

export default async function (context, req) {
    try {
        context.log('!--End Blob triggered', req.query.fileName);

        const blobStorage = BlobServiceClient.fromConnectionString(process.env.Azure_BLOB_CONNECTION)

        const containerName = req.query.container
        const folder = req.query.folder ? req.query.folder + '/' : ''
        const fileName = req.query.fileName

        if (!containerName) throw new Error('Must Specify Container')
        if (!fileName) throw new Error('Must Specify File Name')

        const container = blobStorage.getContainerClient(containerName)

        const blob = container.getBlockBlobClient(`${folder + fileName}`)
        context.log('file deleting exists?', blob.exists())

        await blob.deleteIfExists({ deleteSnapshots: 'include' })
        return {
            status: 200,
            body: `${fileName} was Deleted`,
            headers: {
                'content-type': 'application/json'
            }
        }
    } catch (error) {
        return {
            status: 400,
            body: error.message
        }
    }
}