import { BlobServiceClient } from "@azure/storage-blob";
import { encode } from "blurhash";
import multipart from 'parse-multipart'
import sharp from "sharp";
export default async function (context, req) {
    context.log('Uploading to blob: ', req.query.container);
    const blobStorage = BlobServiceClient.fromConnectionString(process.env.AZURE_BLOB_CONNECTION)
    try {
        console.log(process.env.AZURE_BLOB_CONNECTION);
        if (!req.query.container) throw new Error('no container specified, specify in query')
        if (!req.query.fileName) throw new Error('no fileName specified, specify in query')

        const compressRate = req.query.compress || 80
        const shrinkAmount = req.query.shrink || 0.5

        const containerName = req.query.container
        const folder = req.query.folder ? req.query.folder + '/' : ''
        const fileName = req.query.fileName.slice(0, req.query.fileName.indexOf('.'))
        const fileExtension = req.query.fileName.slice(req.query.fileName.indexOf('.'))
        // parse multipart
        const bodyBuffer = Buffer.from(req.body);
        const boundary = multipart.getBoundary(req.headers["content-type"]);
        const parts = multipart.Parse(bodyBuffer, boundary);

        if (parts.length <= 0) throw new Error('no File attached')
        const file = parts[0]
        const fileType = file.type.replace(/(.*)\//g, '')

        let fileWidth, fileHeight
        const buffer = Buffer.from(file.data)
        // compress
        const scaleByHalf = await sharp(buffer)
            .metadata()
            .then(({ width, height }) => {
                fileWidth = width
                fileHeight = height
                return sharp(buffer)
                    .resize(Math.round(width * shrinkAmount))
                    .jpeg({ quality: compressRate, chromaSubsampling: '4:4:4' })
                    .toBuffer()
            }
            );
        const container = blobStorage.getContainerClient(containerName)

        const blockBlob = container.getBlockBlobClient(folder + fileName + `.${fileType}`)
        const compBlockBlob = container.getBlockBlobClient(folder + 'mini_' + fileName + '.jpg')
        const blobtions = { blobHTTPHeaders: { blobContentType: 'image/' + fileType, blobCacheControl: 'max-age=36000' } }

        const response = await blockBlob.upload(file.data, file.data.length, blobtions)
        const compRes = await compBlockBlob.upload(scaleByHalf, scaleByHalf.length, blobtions)


        context.log('[blob res]', response)
        const body = {
            fileName: fileName,
            url: blockBlob.url,
            smallUrl: compBlockBlob.url,
            height: fileHeight,
            width: fileWidth
        }
        // blur
        if (req.body.blur != false) {
            body.blurHash = await getBlur(scaleByHalf)
        }
        // return result
        return {
            status: 200,
            body: body,
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


async function getBlur(buffer) {
    try {
        let { data: raw, info: metadata } = await sharp(buffer).resize({ width: 350 }).raw().ensureAlpha().toBuffer({ resolveWithObject: true })
        let clamped = new Uint8ClampedArray(raw)
        return encode(clamped, metadata.width, metadata.height, 4, 4)
    } catch (error) {
        return '[BLURHASH ERROR]' + error.message
    }
}