import sgMail, { MailDataRequired } from '@sendgrid/mail';
import config from '../config';
import pug from 'pug';
import path from 'path';
import fs from 'fs';


sgMail.setApiKey(config.SENDGRID_API_KEY);


// Function to read the Pug template file and render it with data
function renderEmail(templatePath: string, data: any): string {
    const template = fs.readFileSync(path.join(process.cwd(), './src/utils/email', templatePath), 'utf-8');
    const compiledFunction = pug.compile(template);
    return compiledFunction(data)
}

export async function sendEmail(to: string, subject: string, pugTemplate: string, templateData: any) {

    const msg: MailDataRequired = {
        to,
        from: config.FROM_EMAIL, // Change to your verified sender
        subject,
        html: renderEmail(pugTemplate, { templateData })
    };

    try {
        await sgMail.send(msg);
        console.log('Email sent successfully!');
    } catch (error) {
        console.error(error);
        throw new Error('Error sending email');
    }
};