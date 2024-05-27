import config from '../config'
import { cryptoDecryption } from './functions'
import { logger } from './logger'
import sgMail from '@sendgrid/mail'

let apiKey = config.SENDGRID_API_KEY ? config.SENDGRID_API_KEY : "";
sgMail.setApiKey(apiKey)
// export let sendMail = (to: any, subject: any, text: any) => {
//     let mailTransporter = nodeMailer.createTransport({
//         service: 'gmail',
//         auth: {
//             user: 'hello.maheksavani@gmail.com',
//             pass: 'pfciklgbyvjjplnu'
//         }
//     });

//     let mailObj = {
//         from: "hello.maheksavani@gmail.com",
//         to: to,
//         subject: subject,
//         text: text
//     }

//     mailTransporter.sendMail(mailObj, (err, data) => {
//         if (err) {
//             logger.error("There is some issue during sending mail", err)
//             throw err
//         } else {
//             console.log("Email Send", data);
//             return "Email send"
//         }
//     })
// }

export let sendMail = (to: string, subject: string, text: any, body?: any, from?: any) => {
    try {
        let flag = true;
        const msg = {
            to: to, // Change to your recipient
            from: 'hello@imentor.org', // Change to your verified sender
            subject: subject,
            text: text,
            html: body

        }
        sgMail
            .send(msg)
            .then(() => {
                console.log('Email sent')
            })
            .catch((error) => {
                flag = false
                console.error(error)
            })

        return flag;
    } catch (error) {
        return false
    }
}