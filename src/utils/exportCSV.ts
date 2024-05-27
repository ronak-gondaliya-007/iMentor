import * as fs from 'fs';
import { writeToPath } from '@fast-csv/format';
import { Request, Response, NextFunction } from 'express';
import { success, error } from "../utils/helpers/resSender";

const exportFileFunction = async (
    csvDownload: boolean,
    preFileName: string,
    data: any,
    response: Response,
    request?: Request
) => {
    let tempFile = '';

    if (csvDownload) {
        tempFile = await csvFileDownload(preFileName, data, response);

        const allSegments = tempFile.split("/");
        const fileName = allSegments[allSegments.length - 1];
        const folderName = allSegments[allSegments.length - 2];
        const filePath = `export/${folderName}/${fileName}`;
        return { filePath: filePath }
    }
};

const csvFileDownload = async (
    fileName: string,
    csvArray: any,
    response: Response
): Promise<string> => {
    return new Promise<string>((resolve) => {
        try {
            fs.mkdirSync('./download/csv/', { recursive: true });
            const time = new Date().getTime();
            const file = `./download/csv/${fileName}.csv`;
            writeToPath(file, csvArray, { headers: true })

                .on('error', (err) => console.error(err))
                .on('finish', () => {
                    resolve(file);
                });
        } catch (error) {
            console.error(error);
        }
    });
};

export default exportFileFunction