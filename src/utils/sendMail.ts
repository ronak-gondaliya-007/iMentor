import AWS from 'aws-sdk';
import { findOne } from './db';

export const sendEmail = async function (from: string, to: string, mailSubject: any, htmlBody?: any) {
    var ses = new AWS.SES({
        accessKeyId: process.env.SES_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.SES_AWS_SECRET_ACCESS_KEY,
        region: process.env.SES_AWS_RELIGION
    });

    //if email not activate then send back false
    let bouncedObj = await findOne({ collection: 'AWSWebhook', query: { email: to.toLowerCase() } })
    if (bouncedObj) return false
    ses.sendEmail({
        Source: from,
        Destination: { ToAddresses: [to] },
        Message: {
            Subject: {
                Data: mailSubject
            },
            Body: {
                Html: {
                    Data: htmlBody
                }
            }
        }
    }, function (err, data) {
        if (err) {
            console.log(err)
            return false;
        }
        console.log('Email sent:', data);
        return true;
    });
}